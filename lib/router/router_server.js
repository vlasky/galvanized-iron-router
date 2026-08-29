import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Iron } from '../core/iron_core.js';
import { Router } from './router.js';

const assert = Iron.utils.assert;
const env = process.env.NODE_ENV || 'development';

/**
 * Server specific initialization.
 */
Router.prototype.init = function (options) {};

/**
 * Give people a chance to customize the body parser
 * behavior.
 */
Router.prototype.configureBodyParsers = function () {
  this.onBeforeAction(Iron.Router.bodyParser.json());
  this.onBeforeAction(Iron.Router.bodyParser.urlencoded({extended: false}));
};

/**
 * Add the router to the server connect handlers.
 */
Router.prototype.start = function () {
  // guard against repeated starts registering the router and its body
  // parser hooks more than once
  if (this._isStarted)
    return;
  this._isStarted = true;

  WebApp.connectHandlers.use(/** @type {any} */ (this));
  this.configureBodyParsers();
};

/**
 * Create a new controller and dispatch into the stack.
 */
Router.prototype.dispatch = function (url, context, done) {
  assert(typeof url === 'string', "expected url string in router dispatch");
  assert(typeof context === 'object', "expected context object in router dispatch");

  // assumes there is only one router
  // XXX need to initialize controller either from the context itself or if the
  // context already has a controller on it, just use that one.
  const controller = this.createController(url, context);

  controller.dispatch(this._stack, url, function (err) {
    const res = this.response;
    const req = this.request;
    let msg;

    if (err) {
      if (res.statusCode < 400)
        res.statusCode = 500;

      if (err.status)
        res.statusCode = err.status;

      if (env === 'development')
        msg = (err.stack || err.toString()) + '\n';
      else
        //XXX get this from standard dict of error messages?
        msg = 'Server error.';

      console.error(err.stack || err.toString());

      if (res.headersSent)
        return req.socket.destroy();

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Length', Buffer.byteLength(msg));
      if (req.method === 'HEAD')
        return res.end();
      res.end(msg);
      return;
    }

    // if there are no client or server handlers for this dispatch
    // then send a 404.
    // XXX we need a solution here for 404s on bad routes.
    //     one solution might be to provide a custom 404 page in the public
    //     folder. But we need a proper way to handle 404s for search engines.
    // XXX might be a PR to Meteor to use an existing status code if it's set
    if (!controller.isHandled() && !controller.willBeHandledOnClient()) {
      return done();
      /*
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');
      msg = req.method + ' ' + req.originalUrl + ' not found.';
      console.error(msg);
      if (req.method == 'HEAD')
        return res.end();
      res.end(msg + '\n');
      return;
      */
    }

    // if for some reason there was a server handler but no client handler
    // and the server handler called next() we might end up here. We
    // want to make sure to end the response so it doesn't hang.
    if (controller.isHandled() && !controller.willBeHandledOnClient()) {
      res.setHeader('Content-Type', 'text/html');
      if (req.method === 'HEAD')
        return res.end();
      res.end("<p>It looks like you don't have any client routes defined, but you had at least one server handler. You probably want to define some client side routes!</p>\n");
    }

    // we'll have Meteor load the normal application so long as
    // we have at least one client route/handler and the done() iterator
    // function has been passed to us, presumably from Connect.
    if (controller.willBeHandledOnClient() && done)
      return done(err);
  });
};

/**
 * As of 2.3.0 this package no longer supplies jQuery (the dependency is
 * weak). On Meteor 2 the client runs Blaze 2, whose DOM backend throws
 * "Error: jQuery not found" at startup unless the app (or another package)
 * includes the jquery package. Blaze throws before any of our client code
 * loads, so the client cannot explain the failure; the server can.
 *
 * The server-side Package namespace only reflects the os arch, so a jquery
 * pulled in by client-only package dependencies is invisible there. The
 * client program manifest is the authoritative list of what the client
 * bundle contains - but only in development: the production minifier
 * concatenates eager package files, erasing per-package manifest entries.
 * The warning is therefore development-only, which is also where it is
 * actionable (the developer who just ran `meteor update`). Returns
 * true/false, or null when no manifest is available (in which case the
 * warning stays silent rather than guessing).
 */
/** @type {any} */ (Router)._clientBundleHasJquery = function () {
  try {
    const programs = /** @type {any} */ (WebApp).clientPrograms || {};
    const archs = Object.keys(programs);
    let sawManifest = false;

    for (let i = 0; i < archs.length; i++) {
      const manifest = programs[archs[i]] && programs[archs[i]].manifest;
      if (Array.isArray(manifest)) {
        sawManifest = true;
        if (manifest.some(function (item) {
          return !!item && item.path === 'packages/jquery.js';
        }))
          return true;
      }
    }

    return sawManifest ? false : null;
  } catch (_err) {
    return null;
  }
};

/** @type {any} */ (Router)._needsJqueryWarning = function (clientBundleHasJquery, isFibersDisabled) {
  return !isFibersDisabled && clientBundleHasJquery === false;
};

Meteor.startup(function () {
  const R = /** @type {any} */ (Router);

  if (env !== 'production' &&
      R._needsJqueryWarning(R._clientBundleHasJquery(), Meteor.isFibersDisabled)) {
    console.warn(
      'vlasky:galvanized-iron-router no longer forces jQuery into your app,\n' +
      'and this app does not include the jquery package. On Meteor 2 the\n' +
      'client uses Blaze 2, which requires jQuery: the client will fail at\n' +
      'startup with "Error: jQuery not found".\n\n' +
      'To fix this, run:\n\n' +
      '  meteor add jquery\n\n' +
      'The jquery package uses the jquery npm package from your node_modules\n' +
      'when installed (meteor npm install jquery@<version>), so you control\n' +
      'which jQuery version your app ships.');
  }
});
