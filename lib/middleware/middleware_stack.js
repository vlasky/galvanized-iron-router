import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';
import { _ } from 'meteor/underscore';
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

    if (name) {
      if (_.has(this._stack, name)) {
        throw new Error("Handler with name '" + name + "' already exists.");
      }
      this._stack[name] = handler;
    }

    return handler;
  }

  findByName(name) {
    return this._stack[name];
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
    const args = _.toArray(arguments);
    let options = {};

    if (typeof args[args.length-1] === 'object')
      options = args.pop();

    _.each(args, (fnOrArray) => {
      if (typeof fnOrArray === 'undefined')
        return;
      else if (typeof fnOrArray === 'function')
        this.push(fnOrArray, options);
      else if (_.isArray(fnOrArray))
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
    const beforeHandler = this._stack[name];

    if (!beforeHandler)
      throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

    const index = _.indexOf(this._stack, beforeHandler);
    this.insertAt(index, path, fn, options);
    return this;
  }

  /**
   * Insert a handler after another named handler.
   *
   */
  insertAfter(name, path, fn, options) {
    const handler = this._stack[name];

    if (!handler)
      throw new Error("Couldn't find a handler named '" + name + "' on the path stack");

    const index = _.indexOf(this._stack, handler);
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
    const clonedOtherStacks = _.map(_.toArray(arguments), (s) => EJSON.clone(s._stack));
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

    url = Url.normalize(url || '/');

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
          // the next iterator to ignore it.
          err._punt = true;

          // now rethrow it!
          throw err;
        }
      }
    };

    let index = 0;

    const next = Meteor.bindEnvironment((err) => {
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

      // get the parameters for this url from the handler's compiled path
      const params = handler.params(url);
      defaultValue(context, 'params', {});
      context.request.params = context.params;
      _.extend(context.params, params);

      // so we can call this.next()
      // XXX this breaks with things like request.body which require that the
      // iterator be saved for the given function call.
      context.next = next;

      if (handler.mount) {
        const mountpath = /** @type {string} */ (Url.normalize(handler.compiledUrl.pathname));
        let newUrl = url.substr(mountpath.length, url.length);
        newUrl = Url.normalize(newUrl);
        context.url = context.request.url = newUrl;
      }

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

        // function (err, req, res, next)
        if (err && arity === 4)
          return handler.handle.call(context, err, req, res, next);

        // function (req, res, next)
        if (!err && arity < 4)
          return handler.handle.call(context, req, res, next);

        // default is function (err) so punt the error down the stack
        // until we either find a handler who likes to deal with errors or we call
        // out
        return next(err);
      } catch (err) {
        if (err._punt)
          // ignore this error and throw it down the stack
          throw err;
        else
          // see if the next handler wants to deal with the error
          next(err);
      } finally {
        // we'll put this at the end because some middleware
        // might want to decide what to do based on whether we've
        // been handled "yet". If we set this to true before the handler
        // is called, there's no way for the handler to say, if we haven't been
        // handled yet go to the server, for example.
        context._handled = true;
        context.next = null;
      }
    });

    next();

    context.next = null;
    return context;
  }
}

Iron.MiddlewareStack = MiddlewareStack;
export { MiddlewareStack };
