import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Iron } from '../core/iron_core.js';
import { Layout } from '../layout/layout.js';
import { Url } from '../url/url.js';
import { Router } from './router.js';

const assert = Iron.utils.assert;
const DEFAULT_NOT_FOUND_TEMPLATE = '__IronRouterNotFound__';
const NO_ROUTES_TEMPLATE = '__IronRouterNoRoutes__';

/**
 * Client specific initialization.
 */
Router.prototype.init = function (options) {
  // the current RouteController from a dispatch
  this._currentController = null;

  // the current route
  this._currentRoute = null;

  // the current() dep
  this._currentDep = new Tracker.Dependency;

  // the location computation
  this._locationComputation = null;

  // the ui layout for the router
  this._layout = new Layout({template: this.options.layoutTemplate});

  Meteor.startup(() => {
    setTimeout(() => {
      if (this.options.autoRender !== false)
        this.insert({el: document.body});
    });
  });
};

/**
 * Programmatically insert the router into document.body or a particular
 * element with {el: 'selector'}
 */
Router.prototype.insert = function (options) {
  this._layout.insert(options);
  return this;
};

/**
 * Returns a layout view that can be used in a UI helper to render the router
 * to a particular place.
 */
Router.prototype.createView = function () {
  return this._layout.create();
};

Router.prototype.lookupNotFoundTemplate = function () {
  if (this.options.notFoundTemplate)
    return this.options.notFoundTemplate;

  return (this.routes.length === 0) ? NO_ROUTES_TEMPLATE : DEFAULT_NOT_FOUND_TEMPLATE;
};

Router.prototype.lookupLayoutTemplate = function () {
  return this.options.layoutTemplate;
};

Router.prototype.dispatch = function (url, context, done) {
  assert(typeof url === 'string', "expected url string in router dispatch");

  const controller = this._currentController;
  const route = this.findFirstRoute(url);
  const prevRoute = this._currentRoute;

  this._currentRoute = route;


  // even if we already have an existing controller we'll stop it
  // and start it again. But since the actual controller instance
  // hasn't changed, the helpers won't need to rerun.
  if (this._currentController)
    this._currentController.stop();

  let newController;
  //XXX Instead of this, let's consider making all RouteControllers
  //    singletons that get configured at dispatch. Will revisit this
  //    after v1.0.
  if (controller && route && prevRoute === route) {
    // this will change the parameters dep so anywhere you call
    // this.getParams will rerun if the parameters have changed
    controller.configureFromUrl(url, context);
    newController = controller;
  } else {
    // Looks like we're on a new route so we'll create a new
    // controller from scratch.
    newController = this.createController(url, context);
  }

  this._currentController = newController;

  // Invalidate Router.current() observers now, together with the value, not
  // after the synchronous dispatch below: a consumer that recomputes when read
  // while invalidated (a lazy "embox" value) otherwise saw the previous
  // controller from inside this dispatch's hooks and action (upstream #1253).
  // Even if the controller instance is reused, a dispatch means the url
  // changed, so either the controller or its parameters are new.
  this._currentDep.changed();

  newController.dispatch(this._stack, url, function onRouterDispatchCompleted (err) {
    if (err)
      throw err;
    else {
      if (!newController.isHandled()) {
        // if we aren't at the initial state, we haven't yet given the server
        //   a true chance to handle this URL. We'll try.
        //   if the server CAN'T handle the router, we'll be back,
        //   but as the very first route handled on the client,
        //   and so initial will be true.
        const state = Tracker.nonreactive(() => { return newController.location.get().options.historyState; });

        if (state && state.initial === true) {
          // looks like there's no handlers so let's give a default
          // not found message! Use the layout defined in global config
          // if we have one.
          //
          // NOTE: this => controller
          this.layout(this.lookupOption('layoutTemplate'), {data: {url: this.url}});

          let errorTemplate;

          if (this.router.routes.length === 0) {
            errorTemplate = this.lookupOption('noRoutesTemplate') || NO_ROUTES_TEMPLATE;
          } else {
            errorTemplate = this.lookupOption('notFoundTemplate') || DEFAULT_NOT_FOUND_TEMPLATE;
          }

          this.render(errorTemplate, {data: {url: this.url}});
          this.renderRegions();

          // kind of janky but will work for now. this makes sure
          // that any downstream functions see that this route has been
          // handled so we don't get into an infinite loop with the
          // server.
          newController.isHandled = function () { return true; };
        }

        return done && done.call(newController);
      }
    }
  });

  return newController;
};

/**
 * The current controller object.
 */
Router.prototype.current = function () {
  this._currentDep.depend();
  return this._currentController;
};

/*
 * Scroll to a specific location on the page.
 * Overridable by applications that want to customize this behavior.
 */
Router.prototype._scrollToHash = function (hashValue) {
  try {
    if (!hashValue || hashValue.charAt(0) !== '#')
      return;

    const id = decodeURIComponent(hashValue.slice(1));
    const target = id && document.getElementById(id);

    if (!target)
      return;

    const top = target.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(window.scrollX, top);
  } catch (_e) {
    // in case the hashValue is bogus just bail out
  }
};

/**
 * Start reacting to location changes.
 */
Router.prototype.start = function () {
  // guard against repeated starts stacking duplicate location autoruns,
  // and let stop() (which checks _isStarted) actually stop the router
  if (this._isStarted)
    return;
  this._isStarted = true;

  let prevLocation;
  const router = this;

  this._locationComputation = Tracker.autorun((c) => {
    const loc = Iron.Location.get();
    const current = this._currentController;

    // Dispatch on the first run when there is no controller yet or the
    // current one was stopped by Router.stop() (a restart must run the
    // route again), and afterwards whenever the path changes. Only the first
    // run looks at isStopped: a route that stopped itself must not be
    // revived by a later hash-only change.
    if (!current || (c.firstRun && current.isStopped) ||
        (prevLocation && prevLocation.path !== loc.path)) {
      this.dispatch(loc.href, null, function onRouterStartDispatchCompleted (_error) {
        // if we're going to the server cancel the url change
        if (!this.isHandled()) {
          loc.cancelUrlChange();
          router._goToServer(loc.path + (loc.hash || ''), loc.options.replaceState === true);
        }
      });
    } else {
      this._scrollToHash(loc.hash);
      // either the query or hash has changed so configure the current
      // controller again.
      current.configureFromUrl(loc.href);
    }

    prevLocation = loc;
  });
};

/**
 * Leave the page for a url the client has no route for (a server route, or
 * an unknown url): a full navigation, replacing the current history entry
 * when the navigation that led here asked for replaceState (upstream #1471),
 * so Router.go(path, null, {replaceState: true}) and this.redirect(...) keep
 * their meaning when the target turns out to be on the server. Overridable by
 * applications that need to navigate differently (a Cordova wrapper, say).
 */
Router.prototype._goToServer = function (url, replace) {
  if (replace)
    window.location.replace(url);
  else
    window.location.assign(url);
};

/**
 * Stop all computations and put us in a not started state.
 */
Router.prototype.stop = function () {
  if (!this._isStarted)
    return;

  if (this._locationComputation)
    this._locationComputation.stop();

  if (this._currentController)
    this._currentController.stop();

  this._isStarted = false;
};

/**
 * Go to a given path or route name, optinally pass parameters and options.
 *
 * Example:
 * router.go('itemsShowRoute', {_id: 5}, {hash: 'frag', query: 'string});
 */
Router.prototype.go = function (routeNameOrPath, params, options) {
  const isPath = /^\/|http/;
  let path;

  options = options || {};

  if (isPath.test(routeNameOrPath)) {
    // it's a path! Apply the query and hash options the way the route-name
    // form does through route.path(); they used to be dropped here (upstream
    // #1610, #1212). The path itself is left as given: the query is appended
    // to any query already there and the hash replaces any hash there.
    path = routeNameOrPath;

    if (options.query || typeof options.hash !== 'undefined') {
      let base = path;
      let hash = '';
      const hashIndex = base.indexOf('#');

      if (hashIndex !== -1) {
        hash = base.slice(hashIndex);
        base = base.slice(0, hashIndex);
      }

      if (options.query) {
        const queryString = Url.toQueryString(options.query);
        if (queryString.length > 1) {
          if (base.indexOf('?') === -1)
            base += '?';
          else if (!/[?&]$/.test(base))
            base += '&';
          base += queryString.slice(1);
        }
      }

      if (typeof options.hash !== 'undefined')
        hash = options.hash ? '#' + encodeURI(String(options.hash).replace(/^#/, '')) : '';

      path = base + hash;
    }
  } else {
    // it's a route name!
    const route = this.findRouteByName(routeNameOrPath);
    assert(route, "No route found named " + JSON.stringify(routeNameOrPath));
    path = route.path(params, Object.assign(options, {throwOnMissingParams: true}));
  }

  // let Iron Location handle it and we'll pick up the change in
  // Iron.Location.get() computation.
  Iron.Location.go(path, options);
};
