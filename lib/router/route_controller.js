import { _ } from 'meteor/underscore';
import { Iron } from '../core/iron_core.js';
import { Controller } from '../controller/controller.js';
import { CurrentOptions } from './current_options.js';

const assert = Iron.utils.assert;

/*****************************************************************************/
/* RouteController */
/*****************************************************************************/
class RouteController extends Controller {
  /** @type {Array} */
  _onStopCallbacks;
  /** @type {import('./route.js').Route} */
  route;
  /** @type {Array} */
  params;
  /** @type {Function} */
  data;
  /** @type {import('./router.js').Router} */
  router;
  /** @type {Object} */
  request;
  /** @type {Object} */
  response;
  /** @type {string} */
  url;
  /** @type {string} */
  originalUrl;
  /** @type {string} */
  method;
  /** @type {import('meteor/tracker').Tracker.Computation} */
  _computation;
  /** @type {import('meteor/tracker').Tracker.Dependency} */
  _paramsDep;
  /** @type {import('../location/location.js').Location} */
  location;
  /** @type {boolean} */
  isStopped;
  /** @type {boolean} */
  _rendered;
  /** @type {Function} */
  next;
  /** @type {boolean} */
  static _hasJustReloaded;

  constructor(options) {
    super(options);
    options = options || {};
    this.options = options;
    this._onStopCallbacks = [];
    this.route = options.route;
    this.params = [];

    // Sometimes the data property can be defined on route options,
    // or even on the global router config. And people will expect the
    // data function to be available on the controller instance if it
    // is defined anywhere in the chain. This ensure that if we have
    // a data function somewhere in the chain, you can call this.data().
    const data = this.lookupOption('data');

    if (typeof data === 'function')
      this.data = _.bind(data, this);
    else if (typeof data !== 'undefined')
      this.data = () => { return data; };

    this.init(options);
  }

  /**
   * Returns an option value following an "options chain" which is this path:
   *
   *   this.options
   *   this (which includes the proto chain)
   *   this.route.options
   *   dynamic variable
   *   this.router.options
   */
  lookupOption(key) {
    // this.route.options
    // NOTE: we've debated whether route options should come before controller but
    // Tom has convinced me that it's easier for people to think about overriding
    // controller stuff at the route option level. However, this has the possibly
    // counterintuitive effect that if you define this.someprop = true on the
    // controller instance, and you have someprop defined as an option on your
    // Route, the route option will take precedence.
    if (this.route && this.route.options && _.has(this.route.options, key))
      return this.route.options[key];

    // this.options
    if (_.has(this.options, key))
      return this.options[key];

    // "this" object or its proto chain
    if (typeof this[key] !== 'undefined')
      return this[key];

    // see if we have the CurrentOptions dynamic variable set.
    const opts = CurrentOptions.get();
    if (opts && _.has(opts, key))
      return opts[key];

    // this.router.options
    if (this.router && this.router.options && _.has(this.router.options, key))
      return this.router.options[key];
  }

  configureFromUrl(url, context, options) {
    assert(typeof url === 'string', 'url must be a string');
    context = context || {};
    this.request = context.request || {};
    this.response = context.response || {};
    this.url = context.url || url;
    this.originalUrl = context.originalUrl || url;
    this.method = this.request.method;
    if (this.route) {
      // pass options to that we can set reactive: false
      this.setParams(this.route.params(url), options);
    }
  }

  /**
   * Returns an array of hook functions for the given hook names. Hooks are
   * collected in this order:
   *
   * router global hooks
   * route option hooks
   * prototype of the controller
   * this object for the controller
   *
   * For example, this.collectHooks('onBeforeAction', 'before')
   * will return an array of hook functions where the key is either onBeforeAction
   * or before.
   *
   * Hook values can also be strings in which case they are looked up in the
   * Iron.Router.hooks object.
   *
   * TODO: Add an options last argument which can specify to only collect hooks
   * for a particular environment (client, server or both).
   */
  _collectHooks(/* hook1, alias1, ... */) {
    const hookNames = _.toArray(arguments);

    const getHookValues = (value) => {
      if (!value)
        return [];
      const lookupHook = this.router.lookupHook;
      const hooks = _.isArray(value) ? value : [value];
      return _.map(hooks, (h) => { return lookupHook(h); });
    };

    const collectInheritedHooks = (ctor, hookName) => {
      let hooks = [];

      if (ctor.__super__)
        hooks = hooks.concat(collectInheritedHooks(ctor.__super__.constructor, hookName));

      return _.has(ctor.prototype, hookName) ?
        hooks.concat(getHookValues(ctor.prototype[hookName])) : hooks;
    };

    const eachHook = (cb) => {
      for (let i = 0; i < hookNames.length; i++) {
        cb(hookNames[i]);
      }
    };

    let routerHooks = [];
    eachHook((hook) => {
      const name = this.route && this.route.getName();
      const hooks = this.router.getHooks(hook, name);
      routerHooks = routerHooks.concat(hooks);
    });

    let protoHooks = [];
    eachHook((hook) => {
      const hooks = collectInheritedHooks(this.constructor, hook);
      protoHooks = protoHooks.concat(hooks);
    });

    let thisHooks = [];
    eachHook((hook) => {
      if (_.has(this, hook)) {
        const hooks = getHookValues(this[hook]);
        thisHooks = thisHooks.concat(hooks);
      }
    });

    let routeHooks = [];
    if (this.route) {
      eachHook((hook) => {
        const hooks = getHookValues(this.route.options[hook]);
        routeHooks = routeHooks.concat(hooks);
      });
    }

    const allHooks = routerHooks
      .concat(routeHooks)
      .concat(protoHooks)
      .concat(thisHooks);

    return allHooks;
  }

  /**
   * Runs each hook and returns the number of hooks that were run.
   */
  runHooks(/* hook, alias1, ...*/ ) {
    const hooks = this._collectHooks.apply(this, arguments);
    for (let i = 0, l = hooks.length; i < l; i++) {
      const h = hooks[i];
      h.call(this);
    }
    return hooks.length;
  }

  getParams() {
    return this.params;
  }

  setParams(value, options) {
    this.params = value;
    return this;
  }

  /**
   * Dispatch to the route. Implemented in route_controller_client.js and route_controller_server.js.
   * @param {Function} [done]
   * @param {string} [url]
   */
  dispatch(done, url) {}

  /**
   * Run a route. Implemented in route_controller_client.js and route_controller_server.js.
   * @param {import('./route.js').Route} route
   * @param {string} url
   * @param {Function} done
   */
  _runRoute(route, url, done) {}

  /**
   * The default action. Override in subclasses. Implemented in route_controller_client.js.
   */
  action() {}

  /**
   * Lookup a template. Implemented in route_controller_client.js.
   */
  lookupTemplate() { return ''; }

  /**
   * Lookup region templates. Implemented in route_controller_client.js.
   */
  lookupRegionTemplates() { return {}; }

  /**
   * Render regions. Implemented in route_controller_client.js.
   */
  renderRegions() {}

  /**
   * Redirect to another route or URL. Implemented in route_controller_client.js.
   * @param {string} urlOrRouteName
   * @param {Object} [params]
   * @param {Object} [options]
   */
  redirect(urlOrRouteName, params, options) {}

  /**
   * Subscribe to a publication. Implemented in route_controller_client.js.
   * @param {string} name
   * @param {...any} args
   */
  subscribe(name, ...args) {}
}

// Set up __super__ for backward compatibility with code that uses it
// (e.g., route_controller_client.js and route_controller_server.js)
RouteController.__super__ = Controller.prototype;

export { RouteController };

Iron.RouteController = RouteController;
