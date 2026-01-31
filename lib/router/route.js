import { Meteor } from 'meteor/meteor';
import { _ } from 'meteor/underscore';
import { Iron } from '../core/iron_core.js';
import { MiddlewareStack } from '../middleware/middleware_stack.js';
import { RouteController } from './route_controller.js';
import { HTTP_METHODS } from './http_methods.js';

const assert = Iron.utils.assert;

/*****************************************************************************/
/* Both */
/*****************************************************************************/

/**
 * Route class for defining routes in the router.
 *
 * Note: The Route uses a factory pattern where calling `new Route()` returns
 * a callable function with all Route methods attached. This is for backwards
 * compatibility with middleware patterns where routes are called as functions:
 * route(req, res, next).
 */
class Route {
  /** @type {Object} */
  options;
  /** @type {MiddlewareStack} */
  _actionStack;
  /** @type {MiddlewareStack} */
  _beforeStack;
  /** @type {MiddlewareStack} */
  _afterStack;
  /** @type {Object<string, boolean>} */
  _methods;
  /** @type {string|RegExp} */
  _path;
  /** @type {import('../middleware/handler.js').Handler} */
  handler;
  /** @type {import('./router.js').Router} */
  router;

  /**
   * @param {string|RegExp} path
   * @param {string|Function|object} [fn]
   * @param {object} [options]
   */
  constructor(path, fn, options) {
    // Use an IIFE to avoid the function getting a name from variable assignment
    // which would interfere with handler name derivation from paths
    /** @type {Route & Function} */
    const route = /** @type {any} */ ((function() {
      return function (req, res, next) {
        const controller = this;
        controller.request = req;
        controller.response = res;
        route.dispatch(req.url, controller, next);
      };
    })());

    if (typeof fn === 'object') {
      options = fn;
      fn = options.action;
    }

    options = options || {};

    if (typeof path === 'string' && path.charAt(0) !== '/') {
      path = options.path ? options.path : '/' + path
    }

    // Copy all prototype methods onto the route function
    Object.getOwnPropertyNames(Route.prototype).forEach(name => {
      if (name !== 'constructor') {
        const descriptor = Object.getOwnPropertyDescriptor(Route.prototype, name);
        if (descriptor) {
          Object.defineProperty(route, name, descriptor);
        }
      }
    });

    // always good to have options
    options = route.options = options || {};

    // the main action function as well as any HTTP VERB action functions will go
    // onto this stack.
    route._actionStack = new MiddlewareStack;

    // any before hooks will go onto this stack to make sure they get executed
    // before the action stack.
    route._beforeStack = new MiddlewareStack;
    route._beforeStack.append(route.options.onBeforeAction);
    route._beforeStack.append(route.options.before);

    // after hooks get run after the action stack
    route._afterStack = new MiddlewareStack;
    route._afterStack.append(route.options.onAfterAction);
    route._afterStack.append(route.options.after);


    // track which methods this route uses
    route._methods = {};

    if (typeof fn === 'string') {
      route._actionStack.push(path, _.extend(options, {
        template: fn
      }));
    } else if (typeof fn === 'function' || typeof fn === 'object') {
      route._actionStack.push(path, fn, options);
    }

    route._path = path;
    return route;
  }

  /**
   * The name of the route is actually stored on the handler since a route is a
   * function that has an unassignable "name" property.
   */
  getName() {
    return this.handler && this.handler.name;
  }

  /**
   * Returns an appropriate RouteController constructor the this Route.
   *
   * There are three possibilities:
   *
   *  1. controller option provided as a string on the route
   *  2. a controller in the global namespace with the converted name of the route
   *  3. a default RouteController
   *
   */
  findControllerConstructor() {
    const resolve = (name, opts) => {
      opts = opts || {};

      // First check the router's controller registry (ES6 module support)
      let C = this.router && this.router._controllers && this.router._controllers[name];

      // Fall back to global namespace lookup
      if (!C) {
        C = Iron.utils.resolve(name);
      }

      if (!C || !RouteController.prototype.isPrototypeOf(C.prototype)) {
        if (opts.supressErrors !== true)
          throw new Error("RouteController '" + name + "' is not defined.");
        else
          return undefined;
      } else {
        return C;
      }
    };

    const convert = (name) => {
      return this.router.toControllerName(name);
    };

    let result;
    const name = this.getName();

    // the controller was set directly
    if (typeof this.options.controller === 'function')
      return this.options.controller;

    // was the controller specified precisely by name? then resolve to an actual
    // javascript constructor value
    else if (typeof this.options.controller === 'string')
      return resolve(this.options.controller);

    // is there a default route controller configured?
    else if (this.router && this.router.options.controller) {
      if (typeof this.router.options.controller === 'function')
        return this.router.options.controller;

      else if (typeof this.router.options.controller === 'string')
        return resolve(this.router.options.controller);
    }

    // otherwise do we have a name? try to convert the name to a controller name
    // and resolve it to a value
    else if (name && (result = resolve(convert(name), {supressErrors: true})))
      return result;

    // otherwise just use an anonymous route controller
    else
      return RouteController;
  }

  /**
   * Create a new controller for the route.
   */
  createController(options) {
    options = options || {};
    const C = this.findControllerConstructor();
    options.route = this;
    const instance = new C(options);
    return instance;
  }

  setControllerParams(controller, url) {
  }

  /**
   * Dispatch into the route's middleware stack.
   */
  dispatch(url, context, done) {
    // call runRoute on the controller which will behave similarly to the previous
    // version of IR.
    assert(context._runRoute, "context doesn't have a _runRoute method");
    return context._runRoute(this, url, done);
  }

  /**
   * Returns a relative path for the route.
   */
  path(params, options) {
    return this.handler.resolve(params, options);
  }

  /**
   * Return a fully qualified url for the route, given a set of parmeters and
   * options like hash and query.
   */
  url(params, options) {
    const path = this.path(params, options);
    let host = (options && options.host) || Meteor.absoluteUrl();

    if (host.charAt(host.length-1) === '/')
      host = host.slice(0, host.length-1);
    return host + path;
  }

  /**
   * Return a params object for the route given a path.
   */
  params(path) {
    return this.handler.params(path);
  }
}

/**
 * Add convenience methods for each HTTP verb.
 *
 * Example:
 *  var route = router.route('/item')
 *    .get(function () { })
 *    .post(function () { })
 *    .put(function () { })
 */
_.each(HTTP_METHODS, (method) => {
  Route.prototype[method] = function (fn) {
    // track the method being used for OPTIONS requests.
    this._methods[method] = true;

    this._actionStack.push(this._path, fn, {
      // give each method a unique name so it doesn't clash with the route's
      // name in the action stack
      name: this.getName() + '_' + method.toLowerCase(),
      method: method,

      // for now just make the handler where the same as the route, presumably a
      // server route.
      where: this.handler.where,
      mount: false
    });

    return this;
  };
});

export { Route };

Iron.Route = Route;
