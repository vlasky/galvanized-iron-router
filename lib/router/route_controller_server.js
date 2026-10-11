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
 * hang: nothing ended the response or called next(). Pass it on instead, with
 * a development warning naming the route.
 */
RouteController.prototype.action = function () {
  if (process.env.NODE_ENV !== 'production') {
    const name = this.route && this.route.getName();
    console.warn('Iron Router: the server route ' + JSON.stringify(name) +
      ' has no action, so the request to ' + this.originalUrl +
      ' is passed on. Give it a function or REST method handlers.');
  }
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
