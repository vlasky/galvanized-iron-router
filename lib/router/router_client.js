import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { _ } from 'meteor/underscore';
import { $ } from 'meteor/jquery';
import { Iron } from '../core/iron_core.js';
import { Layout } from '../layout/layout.js';
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

  // Note: even if the controller didn't actually change I change the
  // currentDep since if we did a dispatch, the url changed and that
  // means either we have a new controller OR the parameters for an
  // existing controller have changed.
  if (this._currentController == newController)
    this._currentDep.changed();

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
    const $target = $(hashValue);
    $('html, body').scrollTop($target.offset().top);
  } catch (_e) {
    // in case the hashValue is bogus just bail out
  }
};

/**
 * Start reacting to location changes.
 */
Router.prototype.start = function () {
  let prevLocation;

  this._locationComputation = Tracker.autorun((_c) => {
    const loc = Iron.Location.get();
    const current = this._currentController;

    if (!current || (prevLocation && prevLocation.path !== loc.path)) {
      this.dispatch(loc.href, null, function onRouterStartDispatchCompleted (_error) {
        // if we're going to the server cancel the url change
        if (!this.isHandled()) {
          loc.cancelUrlChange();
          window.location = loc.path;
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
    // it's a path!
    path = routeNameOrPath;
  } else {
    // it's a route name!
    const route = this.routes[routeNameOrPath];
    assert(route, "No route found named " + JSON.stringify(routeNameOrPath));
    path = route.path(params, _.extend(options, {throwOnMissingParams: true}));
  }

  // let Iron Location handle it and we'll pick up the change in
  // Iron.Location.get() computation.
  Iron.Location.go(path, options);
};
