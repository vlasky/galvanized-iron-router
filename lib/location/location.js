import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { $ } from 'meteor/jquery';
import { Iron } from '../core/iron_core.js';
import { Url } from '../url/url.js';
import { State } from './state.js';
import { urlToHashStyle, urlFromHashStyle, fixHashPath } from './utils.js';

// Access Package from global scope for weak dependency checking
const Package = /** @type {any} */ (globalThis.Package || {});

/*****************************************************************************/
/* Imports */
/*****************************************************************************/

/*****************************************************************************/
/* Private */
/*****************************************************************************/
let current = null;
const dep = new Tracker.Dependency;
const handlers = {go: [], popState: []};

const isIE9 = function () {
  return /MSIE 9/.test(navigator.appVersion);
};

const isIE8 = function () {
  return /MSIE 8/.test(navigator.appVersion);
};

const usingAppcache = function() {
  return !! Package.appcache;
}

const replaceStateUndefined = function() {
  return (typeof history === "undefined")  || (typeof history.pushState !== "function");
}

const shouldUseHashPaths = function () {
  return Location.options.useHashPaths || isIE8() || isIE9() || usingAppcache() || replaceStateUndefined();
};

const isUsingHashPaths = function () {
  return !!Location.options.useHashPaths;
};

const runHandlers = function(name, state) {
  handlers[name].forEach(function(cb) {
    cb.call(state);
  });
}

const set = function (state) {
  if (!(state instanceof State))
    throw new Error("Expected a State instance");

  if (!state.equals(current)) {
    current = state;
    dep.changed();

    // return true to indicate state was set to a new value.
    return true;
  }

  // state not set
  return false;
};

const setStateFromEventHandler = function () {
  const href = location.href;
  let state;

  if (isUsingHashPaths()) {
    state = new State(urlFromHashStyle(href));
  } else {
    state = new State(href, {historyState: history.state});
  }

  runHandlers('popState', state);
  set(state);
};

const fireOnClick = function (e) {
  const handler = onClickHandler;
  handler && handler(e);
};

/**
 * Go to a url.
 */
const go = function (url, options) {
  options = options || {};

  const state = new State(url, options);

  runHandlers('go', state);

  if (set(state)) {
    Tracker.afterFlush(function () {
      // if after we've flushed if nobody has cancelled the state then change
      // the url.
      if (!state.isCancelled()) {
        if (isUsingHashPaths()) {
          location.hash = fixHashPath(url);
        } else {
          if (options.replaceState === true)
            history.replaceState(options.historyState, null, url);
          else
            history.pushState(options.historyState, null, url);
        }
      }
    });
  }
};

let onClickHandler = function (e) {
  try {
    const el = e.currentTarget;
    let href, path;

    // Support both regular and SVG links
    if( el.href instanceof SVGAnimatedString ) {
      href = el.href.animVal;
      path = href;
    }
    else {
      href = el.href;
      path = el.pathname + el.search + el.hash;
    }

    // ie9 omits the leading slash in pathname - so patch up if it's missing
    path = path.replace(/(^\/?)/,"/");

    // haven't been cancelled already
    if (e.isDefaultPrevented()) {
      e.preventDefault();
      return;
    }

    // with no meta key pressed
    if (e.metaKey || e.ctrlKey || e.shiftKey)
      return;

    // aren't targeting a new window
    if (el.target)
      return;

    // aren't external to the app
    if (!Url.isSameOrigin(href, location.href))
      return;

    // note that we _do_ handle links which point to the current URL
    // and links which only change the hash.
    e.preventDefault();

    // manage setting the new state and maybe pushing onto the pushState stack
    go(path);
  } catch (err) {
    // make sure we can see any errors that are thrown before going to the
    // server.
    e.preventDefault();
    throw err;
  }
};

/*****************************************************************************/
/* Location API */
/*****************************************************************************/

/**
 * Main Location object. Reactively respond to url changes. Normalized urls
 * between hash style (ie8/9) and normal style using pushState.
 */
const Location = {};

/**
 * Default options.
 */
Location.options = {
  linkSelector: 'a[href]',
  useHashPaths: false
};

/**
 * Set options on the Location object.
 */
Location.configure = function (options) {
  Object.assign(this.options, options || {});
};

/**
 * Reactively get the current state.
 */
Location.get = function () {
  dep.depend();
  return current;
};

/**
 * Set the initial state and start listening for url events.
 */
Location.start = function () {
  if (this._isStarted)
    return;

  const parts = Url.parse(location.href);

  // if we're using the /#/items/5 style then start off at the root url but
  // store away the pathname, query and hash into the hash fragment so when the
  // client gets the response we can render the correct page.
  if (shouldUseHashPaths()) {
    // if we have any pathname like /items/5 take a trip to the server to get us
    // back a root url.
    if (parts.pathname.length > 1) {
      const url = urlToHashStyle(location.href);
      window.location = /** @type {any} */ (url);
    }

    // ok good to go
    Location.configure({useHashPaths: true});
  }
  // set initial state
  let href = location.href;

  if (isUsingHashPaths()) {
    const state = new State(urlFromHashStyle(href));
    set(state);
  } else {
    // if we started at a URL in the /#!items/5 style then we have picked up a
    // URL from an non-HTML5 user. Let's redirect to /items/5
    if (parts.hash.replace('#', '')[0] === '!') {
      href = urlFromHashStyle(href);
    }

    // store the fact that this is the first route we hit.
    // this serves two purposes
    //   1. We can tell when we've reached an unhandled route and need to show a
    //      404 (rather than bailing out to let the server handle it)
    //   2. Users can look at the state to tell if the history.back() will stay
    //      inside the app (this is important for mobile apps).
    const historyState = {initial: true}
    history.replaceState(historyState, null, href);
    const state = new State(href, {historyState: historyState});
    set(state);
  }

  // bind the event handlers
  $(window).on('popstate.iron-location', setStateFromEventHandler);
  $(window).on('hashchange.iron-location', setStateFromEventHandler);

  // make sure we have a document before binding the click handler
  Meteor.startup(function () {
    $(document).on('click.iron-location', Location.options.linkSelector, fireOnClick);
  });

  this._isStarted = true;
};

/**
 * Stop the Location from listening for url changes.
 */
Location.stop = function () {
  if (!this._isStarted)
    return;

  $(window).off('popstate.iron-location');
  $(window).off('hashchange.iron-location');
  $(document).off('click.iron-location');

  this._isStarted = false;
};

/**
 * Assign a different click handler.
 */
Location.onClick = function (fn) {
  onClickHandler = fn;
};

/**
 * Go to a new url.
 */
Location.go = function (url, options) {
  return go(url, options);
};

/**
 * Run the supplied callback whenever we "go" to a new location.
 *
 * Argument: cb - function, called with no arguments,
 * `this` is the state that's being set, _may_ be modified.
 */
Location.onGo = function (cb) {
  handlers.go.push(cb);
};

/**
 * Run the supplied callback whenever we "popState" to an old location.
 *
 * Argument: cb - function, called with no arguments,
 * `this` is the state that's being set, _may_ be modified.
 */
Location.onPopState = function (cb) {
  handlers.popState.push(cb);
};

/**
 * Automatically start Iron.Location
 */
Location.start();

export { Location };

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Location = Location;
