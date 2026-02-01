import { Blaze, HTML } from 'meteor/blaze';
import { EJSON } from 'meteor/ejson';
import { Iron } from '../core/iron_core.js';
import { DynamicTemplate } from '../dynamic-template/dynamic_template.js';
import { Router } from './global_router.js';

// UI is the deprecated name for Blaze, needed for UI.registerHelper
const UI = Blaze;

const warn = Iron.utils.warn;

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/

/**
 * Render the Router to a specific location on the page instead of the
 * document.body.
 */
UI.registerHelper('Router', new Blaze.Template('Router', function () {
  return Router.createView();
}));

/**
 * Returns a relative path given a route name, data context and optional query
 * and hash parameters.
 */
UI.registerHelper('pathFor', function (options) {
  let routeName;

  if (arguments.length > 1) {
    routeName = arguments[0];
    options = arguments[1] || {};
  }

  let opts = options && options.hash;

  opts = opts || {};

  let path = '';
  const query = opts.query;
  const hash = opts.hash;
  routeName = routeName || opts.route;
  const data = Object.assign({}, opts.data || this);

  const route = Router.routes[routeName];
  warn(route, "pathFor couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    route.handler.compiledUrl.keys.forEach((keyConfig) => {
      const key = keyConfig.name;
      if (Object.prototype.hasOwnProperty.call(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    path = route.path(data, {query: query, hash: hash});
  }

  return path;
});

/**
 * Returns a relative path given a route name, data context and optional query
 * and hash parameters.
 */
UI.registerHelper('urlFor', function (options) {
  let routeName;

  if (arguments.length > 1) {
    routeName = arguments[0];
    options = arguments[1] || {};
  }

  let opts = options && options.hash;

  opts = opts || {};
  let url = '';
  const query = opts.query;
  const hash = opts.hash;
  routeName = routeName || opts.route;
  const data = Object.assign({}, opts.data || this);

  const route = Router.routes[routeName];
  warn(route, "urlFor couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    route.handler.compiledUrl.keys.forEach((keyConfig) => {
      const key = keyConfig.name;
      if (Object.prototype.hasOwnProperty.call(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    url = route.url(data, {query: query, hash: hash});
  }

  return url;
});

/**
 * Create a link with optional content block.
 *
 * Example:
 *   {{#linkTo route="one" query="query" hash="hash" class="my-cls"}}
 *    <div>My Custom Link Content</div>
 *   {{/linkTo}}
 */
UI.registerHelper('linkTo', new Blaze.Template('linkTo', function () {
  const self = this;
  const opts = DynamicTemplate.getInclusionArguments(this);

  if (typeof opts !== 'object')
    throw new Error("linkTo options must be key value pairs such as {{#linkTo route='my.route.name'}}. You passed: " + JSON.stringify(opts));

  let path = '';
  const query = opts.query;
  const hash = opts.hash;
  const routeName = opts.route;
  const data = Object.assign({}, opts.data || DynamicTemplate.getParentDataContext(this));
  const route = Router.routes[routeName];

  warn(route, "linkTo couldn't find a route named " + JSON.stringify(routeName));

  if (route) {
    route.handler.compiledUrl.keys.forEach((keyConfig) => {
      const key = keyConfig.name;
      if (Object.prototype.hasOwnProperty.call(opts, key)) {
        data[key] = EJSON.clone(opts[key]);

        // so the option doesn't end up on the element as an attribute
        delete opts[key];
      }
    });

    path = route.path(data, {query: query, hash: hash});
  }

  // anything that isn't one of our keywords we'll assume is an attributed
  // intended for the <a> tag
  const keysToOmit = ['route', 'query', 'hash', 'data'];
  const attrs = {};
  Object.keys(opts).forEach((key) => {
    if (!keysToOmit.includes(key))
      attrs[key] = opts[key];
  });
  attrs.href = path;

  return Blaze.With(() => {
    return DynamicTemplate.getParentDataContext(self);
  }, () => {
    return HTML.A(attrs, self.templateContentBlock);
  });
}));
