import { Meteor } from 'meteor/meteor';
import { Iron } from '../core/iron_core.js';
import { MiddlewareStack } from '../middleware/middleware_stack.js';
import { Route } from './route.js';
import { RouteController } from './route_controller.js';
import { CurrentOptions } from './current_options.js';

const warn = Iron.utils.warn;
const assert = Iron.utils.assert;

/**
 * Router class for handling client and server routing.
 *
 * Note: The Router uses a factory pattern where calling `new Router()` returns
 * a callable function with all Router methods attached. This is for backwards
 * compatibility with Connect/Express middleware patterns where routers are
 * called as functions: router(req, res, next).
 */
class Router {
  /** @type {MiddlewareStack} */
  _stack;
  /** @type {Object<string, Array>} */
  _globalHooks;
  /** @type {Array & { _byPath?: Object<string, Route> }} */
  routes;
  /** @type {Object<string, Function>} */
  _controllers;
  /** @type {Object} */
  options;
  /** @type {import('../layout/layout.js').Layout} */
  _layout;
  /** @type {Function} */
  _templateNameConverter;
  /** @type {Function} */
  _controllerNameConverter;
  /** @type {RouteController} */
  _currentController;
  /** @type {Route} */
  _currentRoute;
  /** @type {import('meteor/tracker').Tracker.Dependency} */
  _currentDep;
  /** @type {import('meteor/tracker').Tracker.Computation} */
  _locationComputation;
  /** @type {boolean} */
  _isStarted;
  /** @type {Function} */
  _scrollToHash;

  /**
   * @param {object} [options]
   */
  constructor(options) {
    // Create the router function that will be returned
    // This keeps the same API: fn(url, context, done)
    /** @type {Router & Function} */
    const routerFn = /** @type {any} */ (function routerMiddleware(req, res, next) {
      //XXX this assumes no other routers on the parent stack which we should probably fix
      routerFn.dispatch(req.url, {
        request: req,
        response: res
      }, next);
    });

    // Copy all prototype methods onto the router function
    Object.getOwnPropertyNames(Router.prototype).forEach(name => {
      if (name !== 'constructor') {
        const descriptor = Object.getOwnPropertyDescriptor(Router.prototype, name);
        if (descriptor) {
          Object.defineProperty(routerFn, name, descriptor);
        }
      }
    });

    // Initialize instance properties on the router function
    // the main router stack
    routerFn._stack = new MiddlewareStack;

    // for storing global hooks like before, after, etc.
    routerFn._globalHooks = {};

    // backward compat and quicker lookup of Route handlers vs. regular function
    // handlers.
    routerFn.routes = [];

    // to make sure we don't have more than one route per path
    routerFn.routes._byPath = {};

    // controller registry for ES6 module support
    routerFn._controllers = {};

    // always good to have options
    routerFn.configure(options);

    // let client and server side routing doing different things here
    routerFn.init(options);

    Meteor.startup(() => {
      Meteor.defer(() => {
        if (routerFn.options.autoStart !== false)
          routerFn.start();
      });
    });

    return routerFn;
  }

  init(options) {}

  /**
   * Start the router. Implemented in router_client.js and router_server.js.
   */
  start() {}

  configure(options) {
    options = options || {};

    const toArray = (value) => {
      if (!value)
        return [];

      if (Array.isArray(value))
        return value;

      return [value];
    };

    // e.g. before: fn OR before: [fn1, fn2]
    Iron.Router.HOOK_TYPES.forEach((type) => {
      if (options[type]) {
        toArray(options[type]).forEach((hook) => {
          this.addHook(type, hook);
        });

        delete options[type];
      }
    });

    this.options = this.options || {};
    Object.assign(this.options, options);

    return this;
  }

  /**
   * Just to support legacy calling. Doesn't really serve much purpose.
   */
  map(fn) {
    return fn.call(this);
  }

  /*
   * XXX removing for now until this is thought about more carefully.
  use(path, fn, opts) {
    if (typeof path === 'function') {
      opts = fn || {};
      opts.mount = true;
      opts.where = opts.where || 'server';
      this._stack.push(path, opts);
    } else {
      opts = opts || {};
      opts.mount = true;
      opts.where = opts.where || 'server';
      this._stack.push(path, fn, opts);
    }

    return this;
  }
  */

  //XXX seems like we could put a params method on the route directly and make it reactive
  route(path, fn, opts) {
    const typeOf = (val) => { return Object.prototype.toString.call(val); };
    assert(typeOf(path) === '[object String]' || typeOf(path) === '[object RegExp]', "Router.route requires a path that is a string or regular expression.");

    if (typeof fn === 'object') {
      opts = fn;
      fn = opts.action;
    }

    const route = new Route(path, fn, opts);

    opts = opts || {};

    // don't mount the route
    opts.mount = false;

    // stack expects a function which is exactly what a new Route returns!
    const handler = this._stack.push(path, route, opts);

    handler.route = route;
    route.handler = handler;
    route.router = this;

    const pathKey = String(handler.path);
    assert(!this.routes._byPath[pathKey],
      "A route for the path " + JSON.stringify(handler.path) + " already exists by the name of " + JSON.stringify(handler.name) + ".");
    this.routes._byPath[pathKey] = route;

    this.routes.push(route);

    if (typeof handler.name === 'string')
      this.routes[handler.name] = route;

    return route;
  }

  /**
   * Find the first route for the given url and options.
   */
  findFirstRoute(url) {
    let isMatch;
    let route;
    for (let i = 0; i < this.routes.length; i++) {
      route = this.routes[i];

      // only matches if the url matches AND the
      // current environment matches.
      isMatch = route.handler.test(url, {
        where: Meteor.isServer ? 'server' : 'client'
      });

      if (isMatch)
        return route;
    }

    return null;
  }

  path(routeName, params, options) {
    const route = this.routes[routeName];
    warn(route, "You called Router.path for a route named " + JSON.stringify(routeName) + " but that route doesn't seem to exist. Are you sure you created it?");
    return route && route.path(params, options);
  }

  url(routeName, params, options) {
    const route = this.routes[routeName];
    warn(route, "You called Router.url for a route named " + JSON.stringify(routeName) + " but that route doesn't seem to exist. Are you sure you created it?");
    return route && route.url(params, options);
  }

  /**
   * Create a new controller for a dispatch.
   */
  createController(url, context) {
    // see if there's a route for this url and environment
    // it's possible that we find a route but it's a client
    // route so we don't instantiate its controller and instead
    // use an anonymous controller to run the route.
    const route = this.findFirstRoute(url);
    let controller;

    context = context || {};

    if (route)
      // let the route decide what controller to use
      controller = route.createController({layout: this._layout});
    else
      // create an anonymous controller
      controller = new RouteController({layout: this._layout});

    controller.router = this;
    controller.configureFromUrl(url, context, {reactive: false});
    return controller;
  }

  setTemplateNameConverter(fn) {
    this._templateNameConverter = fn;
    return this;
  }

  setControllerNameConverter(fn) {
    this._controllerNameConverter = fn;
    return this;
  }

  toTemplateName(str) {
    if (this._templateNameConverter)
      return this._templateNameConverter(str);
    else
      return Iron.utils.classCase(str);
  }

  toControllerName(str) {
    if (this._controllerNameConverter)
      return this._controllerNameConverter(str);
    else
      return Iron.utils.classCase(str) + 'Controller';
  }

  /**
   * Register a controller for ES6 module support.
   * This avoids the need to attach controllers to the global window object.
   *
   * Can be called two ways:
   *   registerController(Controller) - uses Controller.name as the key
   *   registerController('Name', Controller) - uses explicit name as the key
   *
   * @param {String|Function} nameOrController - The controller name or the controller class
   * @param {Function} [controller] - The controller class (if first arg is name)
   * @return {Router} Returns this for chaining
   * @api public
   */
  registerController(nameOrController, controller) {
    let name;
    if (typeof nameOrController === 'function') {
      // Called as registerController(Controller)
      controller = nameOrController;
      name = controller.name;
      if (!name) {
        throw new Error('Controller must have a name. Use registerController(name, controller) for anonymous functions.');
      }
    } else if (arguments.length === 1) {
      // Single argument that's not a function - expected to be a controller
      throw new Error('Controller must be a function.');
    } else {
      // Called as registerController('Name', Controller)
      name = nameOrController;
    }
    if (typeof name !== 'string' || !name) {
      throw new Error('Controller name must be a non-empty string.');
    }
    if (typeof controller !== 'function') {
      throw new Error('Controller must be a function.');
    }
    this._controllers[name] = controller;
    return this;
  }

  /**
   * Register multiple controllers at once.
   *
   * @param {Array} controllers - Array of controller classes (names extracted from .name)
   * @return {Router} Returns this for chaining
   * @api public
   */
  registerControllers(controllers) {
    if (!Array.isArray(controllers)) {
      throw new Error('registerControllers expects an array of controllers.');
    }
    controllers.forEach((controller) => {
      this.registerController(controller);
    });
    return this;
  }

  /**
   * Get a registered controller by name.
   *
   * @param {String} name - The controller name
   * @return {Function|undefined} The controller class or undefined
   * @api public
   */
  getController(name) {
    return this._controllers[name];
  }

  /**
   *
   * Add a hook to all routes. The hooks will apply to all routes,
   * unless you name routes to include or exclude via `only` and `except` options
   *
   * @param {String} [type] one of 'load', 'unload', 'before' or 'after'
   * @param {Object} [options] Options to controll the hooks [optional]
   * @param {Function} [hook] Callback to run
   * @return {Router}
   * @api public
   *
   */
  addHook(type, hook, options) {
    options = options || {};

    const toArray = (input) => {
      if (!input)
        return [];
      else if (Array.isArray(input))
        return input;
      else
        return [input];
    }

    if (options.only)
      options.only = toArray(options.only);
    if (options.except)
      options.except = toArray(options.except);

    const hooks = this._globalHooks[type] = this._globalHooks[type] || [];

    // Capture router reference for lookupHook
    const router = this;
    const hookWithOptions = function (...args) {
      const thisArg = this;
      // this allows us to bind hooks to options that get looked up when you call
      // this.lookupOption from within the hook. And it looks better to keep
      // plugin/hook related options close to their definitions instead of
      // Router.configure. But we use a dynamic variable so we don't have to
      // pass the options explicitly as an argument and plugin creators can
      // just use this.lookupOption which will follow the proper lookup chain from
      // "this", local options, dynamic variable options, route, router, etc.
      return CurrentOptions.withValue(options, () => {
        return router.lookupHook(hook).apply(thisArg, args);
      });
    };

    hooks.push({options: options, hook: hookWithOptions});
    return this;
  }

  /**
   * If the argument is a function return it directly. If it's a string, see if
   * there is a function in the Iron.Router.hooks namespace. Throw an error if we
   * can't find the hook.
   */
  lookupHook(nameOrFn) {
    const fn = nameOrFn;

    // if we already have a func just return it
    if (typeof fn === 'function')
      return fn;

    // look up one of the out-of-box hooks like
    // 'loaded or 'dataNotFound' if the nameOrFn is a
    // string
    if (typeof fn === 'string') {
      if (typeof Iron.Router.hooks[fn] === 'function')
        return Iron.Router.hooks[fn];
    }

    // we couldn't find it so throw an error
    throw new Error("No hook found named: " + nameOrFn);
  }

  /**
   *
   * Fetch the list of global hooks that apply to the given route name.
   * Hooks are defined by the .addHook() function above.
   *
   * @param {String} [type] one of IronRouter.HOOK_TYPES
   * @param {String} [name] the name of the route we are interested in
   * @return {Function[]} an array of hooks to run
   * @api public
   *
   */
  getHooks(type, name) {
    const hooks = [];

    const globalHooksForType = this._globalHooks[type] || [];
    globalHooksForType.forEach((hook) => {
      const options = hook.options;

      if (options.except && options.except.includes(name))
        return;

      if (options.only && !options.only.includes(name))
        return;

      hooks.push(hook.hook);
    });

    return hooks;
  }

  /**
   * Add a plugin to the router instance.
   */
  plugin(nameOrFn, options) {
    let func;

    if (typeof nameOrFn === 'function')
      func = nameOrFn;
    else if (typeof nameOrFn === 'string')
      func = Iron.Router.plugins[nameOrFn];

    if (!func)
      throw new Error("No plugin found named " + JSON.stringify(nameOrFn));

    // fn(router, options)
    func.call(this, this, options);

    return this;
  }

  /**
   * Dispatch a url to the router. Implemented in router_client.js and router_server.js.
   * @param {string} url
   * @param {Object} [context]
   * @param {Function} [done]
   */
  dispatch(url, context, done) {}

  /**
   * Insert the router layout into the DOM. Implemented in router_client.js.
   * @param {Object} [options]
   */
  insert(options) {}

  /**
   * Create a reactive view. Implemented in router_client.js.
   */
  createView() { return null; }

  /**
   * Lookup the not found template. Implemented in router_client.js.
   */
  lookupNotFoundTemplate() { return ''; }

  /**
   * Lookup the layout template. Implemented in router_client.js.
   */
  lookupLayoutTemplate() { return ''; }

  /**
   * Navigate to a route. Implemented in router_client.js.
   * @param {string} routeNameOrPath
   * @param {Object} [params]
   * @param {Object} [options]
   */
  go(routeNameOrPath, params, options) {}

  /**
   * Get current route info. Implemented in router_client.js.
   * @returns {Object}
   */
  current() {}

  /**
   * Stop the router. Implemented in router_client.js.
   */
  stop() {}

  /**
   * Configure body parsers. Implemented in router_server.js.
   */
  configureBodyParsers() {}
}

/**
 * Hook types supported by the router.
 */
Router.HOOK_TYPES = [
  'onRun',
  'onRerun',
  'onBeforeAction',
  'onAfterAction',
  'onStop',

  // not technically a hook but we'll use it
  // in a similar way. This will cause waitOn
  // to be added as a method to the Router and then
  // it can be selectively applied to specific routes
  'waitOn',
  'subscriptions',

  // legacy hook types but we'll let them slide
  'load', // onRun
  'before', // onBeforeAction
  'after', // onAfterAction
  'unload' // onStop
];

/**
 * A namespace for hooks keyed by name.
 */
Router.hooks = {};

/**
 * A namespace for plugin functions keyed by name.
 */
Router.plugins = {};

/**
 * Body parser middleware. Set in body_parser_server.js.
 * @type {Object}
 */
Router.bodyParser = {};

/**
 * Static onBeforeAction for global hooks. Used in router_server.js.
 * @param {Function} hook
 * @param {Object} [options]
 */
Router.onBeforeAction = function(hook, options) {};

/**
 * Auto add helper methods for all the hooks.
 */
Router.HOOK_TYPES.forEach((type) => {
  Router.prototype[type] = function (hook, options) {
    this.addHook(type, hook, options);
  };
});

export { Router };

Iron.Router = Router;
