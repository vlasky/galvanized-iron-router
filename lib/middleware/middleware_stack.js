import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { Iron } from '../core/iron_core.js';
import { Url } from '../url/url.js';
import { Handler } from './handler.js';

const assert = Iron.utils.assert;
const defaultValue = Iron.utils.defaultValue;

/**
 * Connect inspired middleware stack that works on the client and the server.
 *
 * You can add handlers to the stack for various paths. Those handlers can run
 * on the client or server. Then you can dispatch into the stack with a
 * given path by calling the dispatch method. This goes down the stack looking
 * for matching handlers given the url and environment (client/server). If we're
 * on the client and we should make a trip to the server, the onServerDispatch
 * callback is called.
 *
 * The middleware stack supports the Connect API. But it also allows you to
 * specify a context so we can have one context object (like a Controller) that
 * is a consistent context for each handler function called on a dispatch.
 *
 */
class MiddlewareStack {
  constructor() {
    this._stack = [];
    // Named handlers live in a prototype-less side map. Storing them as
    // properties on the _stack array let a handler named after any Array
    // member (a route at /push, /map, /length, ...) shadow the method and
    // corrupt the stack.
    this._byName = Object.create(null);
    this.length = 0;
    this._onServerDispatch = null;
  }

  /**
   * Register a callback to be called when dispatch encounters a server
   * handler while running on the client.
   */
  onServerDispatch(callback) {
    this._onServerDispatch = callback;
    return this;
  }

  _create(path, fn, options) {
    const handler = new Handler(path, fn, options);
    const name = handler.name;
    // Check the options the Handler actually resolved: callers commonly pass
    // (fn, {name: ...}), which arrives here with the options object in the
    // fn parameter slot.
    const hasExplicitName = !!(handler.options &&
      Object.prototype.hasOwnProperty.call(handler.options, 'name'));

    if (name) {
      if (name in this._byName) {
        // Allow duplicate implicit names for middleware (e.g. hook wrappers).
        if (!(handler.middleware && !hasExplicitName)) {
          throw new Error("Handler with name '" + name + "' already exists.");
        }
      } else {
        this._byName[name] = handler;
      }
    }

    return handler;
  }

  findByName(name) {
    return this._byName[name];
  }

  /**
   * Push a new handler onto the stack.
   */
  push(path, fn, options) {
    const handler = this._create(path, fn, options);
    this._stack.push(handler);
    this.length++;
    return handler;
  }

  append(/* fn1, fn2, [f3, f4]... */) {
    const args = Array.from(arguments);
    let options = {};

    if (typeof args[args.length-1] === 'object')
      options = args.pop();

    args.forEach((fnOrArray) => {
      if (typeof fnOrArray === 'undefined')
        return;
      else if (typeof fnOrArray === 'function')
        this.push(fnOrArray, options);
      else if (Array.isArray(fnOrArray))
        this.append.apply(this, fnOrArray.concat([options]));
      else
        throw new Error("Can only append functions or arrays to the MiddlewareStack");
    });

    return this;
  }

  /**
   * Insert a handler at a specific index in the stack.
   *
   * The index behavior is the same as Array.prototype.splice. If the index is
   * greater than the stack length the handler will be appended at the end of the
   * stack. If the index is negative, the item will be inserted "index" elements
   * from the end.
   */
  insertAt(index, path, fn, options) {
    const handler = this._create(path, fn, options);
    this._stack.splice(index, 0, handler);
    this.length = this._stack.length;
    return this;
  }

  /**
   * Insert a handler before another named handler.
   */
  insertBefore(name, path, fn, options) {
    const beforeHandler = this._byName[name];

    if (!beforeHandler)
      throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

    const index = this._stack.indexOf(beforeHandler);
    this.insertAt(index, path, fn, options);
    return this;
  }

  /**
   * Insert a handler after another named handler.
   *
   */
  insertAfter(name, path, fn, options) {
    const handler = this._byName[name];

    if (!handler)
      throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

    const index = this._stack.indexOf(handler);
    this.insertAt(index + 1, path, fn, options);
    return this;
  }

  /**
   * Return a new MiddlewareStack comprised of this stack joined with other
   * stacks. Note the new stack will not have named handlers anymore. Only the
   * handlers are cloned but not the name=>handler mapping.
   */
  concat(/* stack1, stack2, */) {
    const ret = new MiddlewareStack;
    const concat = Array.prototype.concat;
    const clonedThisStack = EJSON.clone(this._stack);
    const clonedOtherStacks = Array.from(arguments).map((s) => EJSON.clone(s._stack));
    ret._stack = concat.apply(clonedThisStack, clonedOtherStacks);
    ret.length = ret._stack.length;
    return ret;
  }

  /**
   * Dispatch into the middleware stack, allowing the handlers to control the
   * iteration by calling this.next();
   */
  dispatch(url, context, done) {

    assert(typeof url === 'string', "Requires url");
    assert(typeof context === 'object', "Requires context object");

    // Keep the raw url (including any query string and hash fragment) so we can
    // extract query parameters below. Url.normalize strips the query string, so
    // computing handler.params() from the normalized url would yield an empty
    // query object that clobbers params already set on the controller. See GH #6.
    const rawUrl = url || '/';
    url = Url.normalize(rawUrl);

    // Save the original context.next before we overwrite it
    const originalNext = context.next;

    defaultValue(context, 'request', {});
    defaultValue(context, 'response', {});
    defaultValue(context, 'originalUrl', url);
    defaultValue(context.request, 'originalUrl', url);

    //defaultValue(context, 'location', Url.parse(originalUrl));
    defaultValue(context, '_method', context.method);
    defaultValue(context, '_handlersForEnv', {client: false, server: false});
    defaultValue(context, '_handled', false);

    defaultValue(context, 'isHandled', () => {
      return context._handled;
    });

    defaultValue(context, 'willBeHandledOnClient', () => {
      return context._handlersForEnv.client;
    });

    defaultValue(context, 'willBeHandledOnServer', () => {
      return context._handlersForEnv.server;
    });

    const wrappedDone = function () {
      // Call done if provided, otherwise fall back to original context.next
      const callback = done || originalNext;
      if (callback) {
        try {
          callback.apply(this, arguments);
        } catch (err) {
          // if we catch an error at this point in the stack we don't want it
          // handled in the next() iterator below. So we'll mark the error to tell
          // the next iterator to ignore it. Primitive throws can't carry the
          // mark (strict mode would throw on the assignment); they lose this
          // protection, as they always have.
          if (err !== null && typeof err === 'object')
            err._punt = true;

          // now rethrow it!
          throw err;
        }
      }
    };

    // Async (promise-returning) handlers still in flight. While this is
    // non-zero, context.next must stay alive so `await ...; this.next()`
    // works; callbacks in _onAsyncDrain run once everything has settled.
    defaultValue(context, '_pendingAsync', 0);
    defaultValue(context, '_onAsyncDrain', []);

    const settleAsync = function () {
      context._pendingAsync--;
      context._handled = true;
      if (context._pendingAsync === 0) {
        context.next = null;
        const callbacks = context._onAsyncDrain.splice(0);
        // Each callback runs in its own try/catch. We are inside the
        // fulfilment branch of the handler's promise chain, which nothing
        // consumes: a throw here (e.g. an onAfterAction hook failing) would
        // become an unhandled rejection - fatal on modern Node. The stack has
        // already completed and the response is usually sent, so there is no
        // error path left to route to; log, as the late-rejection path does,
        // and let the remaining callbacks run.
        callbacks.forEach((cb) => {
          try {
            cb();
          } catch (e) {
            console.error("Iron Router: error after the dispatch completed:",
              (e && e.stack) || e);
          }
        });
      }
    };

    let index = 0;

    // @types/meteor declares the 1-arg form only; the onException parameter
    // is real (see Meteor's dynamics_nodejs.js / dynamics_browser.js)
    const bindEnvironment = /** @type {(fn: Function, onException?: Function) => any} */ (
      Meteor.bindEnvironment);

    const next = bindEnvironment((err) => {
      const handler = this._stack[index++];

      // reset the url
      context.url = context.request.url = context.originalUrl;

      if (!handler)
        return wrappedDone.call(context, err);

      if (!handler.test(url, {method: context._method}))
        return next(err);

      // okay if we've gotten this far the handler matches our url but we still
      // don't know if this is a client or server handler. Let's track that.
      // XXX couldn't the environment be something else like cordova?
      const where = Meteor.isClient ? 'client' : 'server';

      // track that we have a handler for the given environment so long as it's
      // not middleware created like this Router.use(function () {}). We'll assume
      // that if the handler is of that form we don't want to make a trip to
      // the client or the server for it.
      if (!handler.middleware)
        context._handlersForEnv[handler.where] = true;

      // but if we're not actually on that env, skip to the next handler.
      if (handler.where !== where) {
        // If we're on client and handler is for server, call onServerDispatch
        if (Meteor.isClient && handler.where === 'server' && this._onServerDispatch) {
          this._onServerDispatch.call(context, handler, url);
        }
        return next(err);
      }

      // get the parameters for this url from the handler's compiled path.
      // Use the raw url so the query string is preserved (handler.params
      // normalizes internally for path matching but splits the raw url for
      // the query object).
      const params = handler.params(rawUrl);
      defaultValue(context, 'params', {});
      context.request.params = context.params;
      Object.assign(context.params, params);

      // so we can call this.next()
      // XXX this breaks with things like request.body which require that the
      // iterator be saved for the given function call.
      // stepNext tracks whether THIS handler already advanced the chain, so
      // the async rejection path below can't complete the stack twice.
      let advanced = false;
      const stepNext = function (e) {
        advanced = true;
        return next(e);
      };
      context.next = stepNext;

      if (handler.mount) {
        // strip what the mount pattern actually matched: a parameterised
        // mount path (/api/:id) consumes a different number of characters
        // than its pattern string is long
        const match = handler.compiledUrl.exec(url);
        const consumed = match ? match[0] :
          /** @type {string} */ (Url.normalize(handler.compiledUrl.pathname));
        let newUrl = url.substr(consumed.length, url.length);
        newUrl = Url.normalize(newUrl);
        context.url = context.request.url = newUrl;
      }

      let isAsync = false;

      try {
        //
        // The connect api says a handler signature (arity) can look like any of:
        //
        // 1) function (req, res, next)
        // 2) function (err, req, res, next)
        // 3) function (err)
        const arity = handler.handle.length
        const req = context.request;
        const res = context.response;
        let result;

        // function (err, req, res, next)
        if (err && arity === 4)
          result = handler.handle.call(context, err, req, res, stepNext);

        // function (req, res, next)
        else if (!err && arity < 4)
          result = handler.handle.call(context, req, res, stepNext);

        // default is function (err) so punt the error down the stack
        // until we either find a handler who likes to deal with errors or we call
        // out
        else
          return next(err);

        // Async handler (Meteor 3 route actions are commonly async since
        // fibers are gone): completion bookkeeping is deferred until the
        // promise settles, and a rejection is routed to the error-handling
        // chain instead of becoming an unhandled rejection (which would
        // hang the request and, on modern Node, crash the process).
        isAsync = !!(result && typeof result.then === 'function');
        if (isAsync) {
          context._pendingAsync++;
          try {
            result.then(
              () => { settleAsync(); },
              (asyncErr) => {
                try {
                  if (advanced) {
                    // the handler already continued the chain before
                    // rejecting; routing the late rejection would complete
                    // the stack (and done) a second time
                    console.error("Iron Router: async handler rejected after calling next():",
                      (asyncErr && asyncErr.stack) || asyncErr);
                  } else {
                    stepNext(asyncErr);
                  }
                } catch (e) {
                  // terminal: done itself failed while handling the async
                  // error; don't leak an unhandled rejection
                  console.error((e && e.stack) || e);
                } finally {
                  settleAsync();
                }
              }
            );
          } catch (thenErr) {
            // exotic thenable whose .then throws synchronously: undo the
            // pending count so drain callbacks still run, then let the
            // outer catch route the error
            context._pendingAsync--;
            isAsync = false;
            throw thenErr;
          }
        }

        // Deliberately do NOT return the handler's result: bindEnvironment
        // attaches ret.catch(onException) to a returned promise, which with
        // our rethrowing onException would manufacture an unhandled
        // rejection (fatal on modern Node). The chain above is the sole
        // consumer of the promise.
        return;
      } catch (err) {
        if (err && err._punt)
          // ignore this error and throw it down the stack
          throw err;
        else if (advanced)
          // the handler continued the chain and then threw; routing the error
          // would complete the stack (and done) a second time, so log it as
          // the late-rejection path does
          console.error("Iron Router: handler threw after calling next():",
            (err && err.stack) || err);
        else
          // see if the next handler wants to deal with the error
          next(err);
      } finally {
        // we'll put this at the end because some middleware
        // might want to decide what to do based on whether we've
        // been handled "yet". If we set this to true before the handler
        // is called, there's no way for the handler to say, if we haven't been
        // handled yet go to the server, for example.
        // Async handlers do this in settleAsync() instead, once the promise
        // settles, so `await ...; this.next()` still has a live next.
        // A sync handler must also leave context.next alive while an async
        // handler deeper in a nested dispatch is still pending (e.g. the
        // route callable frame unwinding around a pending async action).
        if (!isAsync) {
          context._handled = true;
          if (!context._pendingAsync)
            context.next = null;
        }
      }
    }, (e) => {
      // Meteor.bindEnvironment's default onException logs and swallows,
      // which would make the _punt rethrow unreachable and hide dispatch
      // failures from the server-side caller's try/catch. Rethrow to
      // preserve the synchronous throw path.
      throw e;
    });

    next();

    if (!context._pendingAsync)
      context.next = null;
    return context;
  }
}

Iron.MiddlewareStack = MiddlewareStack;
export { MiddlewareStack };
