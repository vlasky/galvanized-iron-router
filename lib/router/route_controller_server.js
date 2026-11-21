import { Meteor } from 'meteor/meteor';
import { MiddlewareStack } from '../middleware/middleware_stack.js';
import { RouteController } from './route_controller.js';

let Fiber;
if (!Meteor.isFibersDisabled) {
  Fiber = Npm.require('fibers');
}

/*****************************************************************************/
/* RouteController */
/*****************************************************************************/

/**
 * Server specific initialization.
 */
RouteController.prototype.init = function (options) {};

/**
 * The action of a server route that has none of its own (no function, no
 * action option, no REST method handlers). A request to such a route used to
 * hang when nothing answered it: nothing ended the response or called next().
 *
 * A route with no hooks of its own either is passed on, with a development
 * warning naming the route (Meteor then serves the client application, as
 * for a url with no route).
 *
 * A route that has hooks of its own (in its options or on its controller) is
 * left alone, as before 2.5.0: a hook may be the route's real handler and
 * answer from a callback or a stream after it called this.next(), or from
 * onAfterAction, and nothing here can tell or wait. In development a warning
 * follows if the request is still unanswered a few seconds later. Global
 * Router hooks do not count as the route's own.
 */
const HOOK_TYPES = ['onRun', 'load', 'onBeforeAction', 'before', 'onAfterAction', 'after'];
const UNANSWERED_WARNING_DELAY = 5000;

RouteController.prototype.action = function () {
  const res = this.response;
  const name = this.route && this.route.getName();
  const describe = () => {
    return 'Iron Router: the server route ' + JSON.stringify(name) +
      ' has no action, ';
  };

  if (res && (res.writableEnded || res.finished))
    return;

  let globalHooks = 0;
  HOOK_TYPES.forEach((type) => { globalHooks += this.router.getHooks(type, name).length; });
  const ownHooks = this._collectHooks.apply(this, HOOK_TYPES).length - globalHooks;

  if (ownHooks > 0) {
    if (process.env.NODE_ENV !== 'production') {
      const url = this.originalUrl;
      const timer = setTimeout(() => {
        if (!(res.writableEnded || res.finished))
          console.warn(describe() + 'and none of its hooks has answered the request to ' + url +
            ' after ' + (UNANSWERED_WARNING_DELAY / 1000) + ' seconds. Give it a function or REST method handlers, or end the response in a hook.');
      }, UNANSWERED_WARNING_DELAY);
      if (timer && typeof timer.unref === 'function')
        timer.unref();
    }
    return;
  }

  if (process.env.NODE_ENV !== 'production')
    console.warn(describe() + 'so the request to ' + this.originalUrl +
      ' is passed on. Give it a function or REST method handlers.');

  // the route's own frame marks the request handled when it unwinds (before
  // this runs when a hook is async); the router's final callback treats an
  // action-less route as no route at all
  this._actionless = true;
  this.next();
};

/**
 * Let this controller run a dispatch process. This function will be called
 * from the router. That way, any state associated with the dispatch can go on
 * the controller instance. Note: no result returned from dispatch because its
 * run inside its own fiber. Might at some point move the fiber stuff to a
 * higher layer.
 */
RouteController.prototype.dispatch = function (stack, url, done) {
  if (Meteor.isFibersDisabled) {
    // Meteor 3.0+: Provide the same exception isolation that Fiber provided
    try {
      stack.dispatch(url, this, done);
    } catch (error) {
      // A punted error means done itself threw while completing the
      // dispatch; re-invoking done would double-handle it.
      if (error && error._punt)
        throw error;
      if (typeof done === 'function') {
        // done reads this.response/this.request off its receiver
        done.call(this, error);
      } else {
        // Log but don't crash - same behavior as Fiber boundary
        console.error('Iron Router: Uncaught exception in route dispatch:', error);
      }
    }
  } else {
    // Meteor < 3.0: Fiber provides exception boundary
    Fiber(() => {
      stack.dispatch(url, this, done);
    }).run();
  }
};

/**
 * Run a route on the server. When the router runs its middleware stack, it
 * can run regular middleware functions or it can run a route. There should
 * only one route object per path as where there may be many middleware
 * functions.
 *
 * For example:
 *
 *   "/some/path" => [middleware1, middleware2, route, middleware3]
 *
 * When a route is dispatched, it tells the controller to _runRoute so that
 * the controller can control the process. At this point we should already be
 * in a dispatch so a computation should already exist.
 */
RouteController.prototype._runRoute = function (route, url, done) {
  let stack = new MiddlewareStack;

  const onRunHooks = this._collectHooks('onRun', 'load');
  stack = stack.append(onRunHooks, {where: 'server'});

  const beforeHooks = this._collectHooks('onBeforeAction', 'before');
  stack.append(beforeHooks, {where: 'server'});

  // make sure the action stack has at least one handler on it that defaults
  // to the 'action' method
  if (route._actionStack.length === 0) {
    route._actionStack.push(route._path, 'action', route.options);
  }

  stack = stack.concat(route._actionStack);
  stack.dispatch(url, this, done);

  // run the after hooks. If an async action is still in flight, defer until
  // the dispatch fully settles so onAfterAction runs after the action
  // completes rather than after its first await.
  const runAfterHooks = () => {
    this.next = function () {};
    this.runHooks('onAfterAction', 'after');
  };

  if (this._pendingAsync)
    this._onAsyncDrain.push(runAfterHooks);
  else
    runAfterHooks();
};
