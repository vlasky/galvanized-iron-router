import { Meteor } from 'meteor/meteor';
import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { Random } from 'meteor/random';
import { Tracker } from 'meteor/tracker';
import { ReactiveVar } from 'meteor/reactive-var';
import { _ } from 'meteor/underscore';
import { Iron } from '../core/iron_core.js';

// UI is the deprecated name for Blaze, needed for UI.registerHelper
const UI = Blaze;

const debug = Iron.utils.debug('iron:dynamic-template');
const assert = Iron.utils.assert;
const get = Iron.utils.get;
const camelCase = Iron.utils.camelCase;

/*****************************************************************************/
/* Private */
/*****************************************************************************/
var typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

/*****************************************************************************/
/* DynamicTemplate */
/*****************************************************************************/

/**
 * Render a component to the page whose template and data context can change
 * dynamically, either from code or from helpers.
 *
 */
const DynamicTemplate = function (options) {
  this._id = Random.id(); 
  this.options = options = options || {};
  this._template = options.template;
  this._defaultTemplate = options.defaultTemplate;
  this._content = options.content;
  this._data = options.data;
  this._templateDep = new Tracker.Dependency;
  this._dataDep = new Tracker.Dependency;

  this._lookupHostDep = new Tracker.Dependency;
  this._lookupHostValue = null;

  this._hooks = {};
  this._eventMap = null;
  this._eventHandles = null;
  this._eventThisArg = null;
  this.name = options.name || this.constructor.prototype.name || 'DynamicTemplate';

  // has the Blaze.View been created?
  this.isCreated = false;

  // has the Blaze.View been destroyed and not created again?
  this.isDestroyed = false;
};

/**
 * Get or set the template.
 */
DynamicTemplate.prototype.template = function (value) {
  if (arguments.length === 1 && value !== this._template) {
    this._template = value;
    this._templateDep.changed();
    return;
  }

  if (arguments.length > 0)
    return;

  this._templateDep.depend();

  // do we have a template?
  if (this._template)
    return (typeof this._template === 'function') ? this._template() : this._template;

  // no template? ok let's see if we have a default one set
  if (this._defaultTemplate)
    return (typeof this._defaultTemplate === 'function') ? this._defaultTemplate() : this._defaultTemplate;
};

/**
 * Get or set the default template.
 *
 * This function does not change any dependencies.
 */
DynamicTemplate.prototype.defaultTemplate = function (value) {
  if (arguments.length === 1)
    this._defaultTemplate = value;
  else
    return this._defaultTemplate;
};

/**
 * Clear the template and data contexts.
 */
DynamicTemplate.prototype.clear = function () {
  //XXX do we need to clear dependencies here too?
  this._template = undefined;
  this._data = undefined;
  this._templateDep.changed();
};

/**
 * Get or set the data context.
 */
DynamicTemplate.prototype.data = function (value) {
  if (arguments.length === 1 && value !== this._data) {
    this._data = value;
    this._dataDep.changed();
    return;
  }

  this._dataDep.depend();
  return typeof this._data === 'function' ? this._data() : this._data;
};

/**
 * Create the view if it hasn't been created yet.
 */
DynamicTemplate.prototype.create = function (options) {
  var self = this;

  if (this.isCreated) {
    throw new Error("DynamicTemplate view is already created");
  }

  this.isCreated = true;
  this.isDestroyed = false;

  var templateVar = ReactiveVar(null);

  var view = Blaze.View('DynamicTemplate', function () {
    var thisView = this;

    // create the template dependency here because we need the entire
    // dynamic template to re-render if the template changes, including
    // the Blaze.With view.
    var template = templateVar.get();

    return Blaze.With(function () {
      // NOTE: This will rerun anytime the data function invalidates this
      // computation OR if created from an inclusion helper (see note below) any
      // time any of the argument functions invlidate the computation. For
      // example, when the template changes this function will rerun also. But
      // it's probably generally ok. The more serious use case is to not
      // re-render the entire template every time the data context changes.
      var result = self.data();

      if (typeof result !== 'undefined')
        // looks like data was set directly on this dynamic template
        return result;
      else
        // return the first parent data context that is not inclusion arguments
        return DynamicTemplate.getParentDataContext(thisView);
    }, function () {
      return self.renderView(template);
    });
  });

  view.onViewCreated(function () {
    this.autorun(function () {
      templateVar.set(self.template());
    });
  });

  // wire up the view lifecycle callbacks
  _.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {
    view[hook](function () {
      // "this" is the view instance
      self._runHooks(hook, this);
    });
  });

  view._onViewRendered(function () {
    // avoid inserting the view twice by accident.
    self.isInserted = true;

    if (view.renderCount !== 1)
      return;

    self._attachEvents();
  });

  view.onViewDestroyed(function () {
    // clean up the event handlers if
    // the view is destroyed
    self._detachEvents();
  });

  view._templateInstance = new Blaze.TemplateInstance(view);
  view.templateInstance = function () {
    // Update data, firstNode, and lastNode, and return the TemplateInstance
    // object.
    var inst = view._templateInstance;

    inst.data = Blaze.getData(view);

    if (view._domrange && !view.isDestroyed) {
      inst.firstNode = view._domrange.firstNode();
      inst.lastNode = view._domrange.lastNode();
    } else {
      // on 'created' or 'destroyed' callbacks we don't have a DomRange
      inst.firstNode = null;
      inst.lastNode = null;
    }

    return inst;
  };

  this.view = view;
  view.__dynamicTemplate__ = this;
  view.name = this.name;
  return view;
};

DynamicTemplate.prototype.renderView = function (template) {
  var self = this;

  // NOTE: When DynamicTemplate is used from a template inclusion helper
  // like this {{> DynamicTemplate template=getTemplate data=getData}} the
  // function below will rerun any time the getData function invalidates the
  // argument data computation.
  var tmpl = null;

  // is it a template name like "MyTemplate"?
  if (typeof template === 'string') {
    tmpl = Template[template];

    if (!tmpl)
      // as a fallback double check the user didn't actually define
      // a camelCase version of the template.
      tmpl = Template[camelCase(template)];

    if (!tmpl) {
      tmpl = Blaze.With({
        msg: "Couldn't find a template named " + JSON.stringify(template) + " or " + JSON.stringify(camelCase(template))+ ". Are you sure you defined it?"
      }, function () {
        return Template.__IronRouterDynamicTemplateError__;
      });
    }
  } else if (typeOf(template) === '[object Object]') {
    // or maybe a view already?
    tmpl = template;
  } else if (typeof self._content !== 'undefined') {
    // or maybe its block content like
    // {{#DynamicTemplate}}
    //  Some block
    // {{/DynamicTemplate}}
    tmpl = self._content;
  }

  return tmpl;
};

/**
 * Destroy the dynamic template, also destroying the view if it exists.
 */
DynamicTemplate.prototype.destroy = function () {
  if (this.isCreated) {
    Blaze.remove(this.view);
    this.view = null;
    this.isDestroyed = true;
    this.isCreated = false;
  }
};

/**
 * View lifecycle hooks.
 */
_.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {
  DynamicTemplate.prototype[hook] = function (cb) {
    var hooks = this._hooks[hook] = this._hooks[hook] || [];
    hooks.push(cb);
    return this;
  };
});

DynamicTemplate.prototype._runHooks = function (name, view) {
  var hooks = this._hooks[name] || [];
  var hook;

  for (var i = 0; i < hooks.length; i++) {
    hook = hooks[i];
    // keep the "thisArg" pointing to the view, but make the first parameter to
    // the callback teh dynamic template instance.
    hook.call(view, this);
  }
};

DynamicTemplate.prototype.events = function (eventMap, thisInHandler) {
  var self = this;

  this._detachEvents();
  this._eventThisArg = thisInHandler;

  var boundMap = this._eventMap = {};

  for (var key in eventMap) {
    boundMap[key] = (function (key, handler) {
      return function (e) {
        var data = Blaze.getData(e.currentTarget);
        if (data == null) data = {};
        var tmplInstance = self.view.templateInstance();
        return handler.call(thisInHandler || this, e, tmplInstance, data);
      }
    })(key, eventMap[key]);
  }

  this._attachEvents();
};

DynamicTemplate.prototype._attachEvents = function () {
  var self = this;
  var thisArg = self._eventThisArg;
  var boundMap = self._eventMap;
  var view = self.view;
  var handles = self._eventHandles;

  if (!view)
    return;

  var domrange = view._domrange;

  if (!domrange)
    throw new Error("no domrange");

  var attach = function (range, element) {
    _.each(boundMap, function (handler, spec) {
      var clauses = spec.split(/,\s+/);
      // iterate over clauses of spec, e.g. ['click .foo', 'click .bar']
      _.each(clauses, function (clause) {
        var parts = clause.split(/\s+/);
        if (parts.length === 0)
          return;

        var newEvents = parts.shift();
        var selector = parts.join(' ');
        handles.push(Blaze._EventSupport.listen(
          element, newEvents, selector,
          function (evt) {
            if (! range.containsElement(evt.currentTarget))
              return null;
            var handlerThis = self._eventThisArg || this;
            var handlerArgs = arguments;
            //XXX which view should this be? What if the event happened
            //somwhere down the hierarchy?
            return Blaze._withCurrentView(view, function () {
              return handler.apply(handlerThis, handlerArgs);
            });
          },
          range, function (r) {
            return r.parentRange;
          }));
      });
    });
  };

  if (domrange.attached)
    attach(domrange, domrange.parentElement);
  else
    domrange.onAttached(attach);
};

DynamicTemplate.prototype._detachEvents = function () {
  _.each(this._eventHandles, function (h) { h.stop(); });
  this._eventHandles = [];
};

/**
 * Insert the Layout view into the dom.
 */
DynamicTemplate.prototype.insert = function (options) {
  options = options || {};

  if (this.isInserted)
    return;
  this.isInserted = true;

  var el = options.el || document.body;
  var $el = $(el);

  if ($el.length === 0)
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback.");

  if (!this.view)
    this.create(options);

  Blaze.render(this.view, $el[0], options.nextNode, options.parentView);

  return this;
};

/**
 * Return the value of the current lookup host or null if there is no lookup host.
 * Pass { reactive: false } to avoid creating a reactive dependency.
 */
DynamicTemplate.prototype._getLookupHost = function (options) {
  var reactive = !(options && options.reactive === false);

  if (reactive && Tracker.active) {
    this._lookupHostDep.depend();
  }

  return this._lookupHostValue;
};

/**
 * Set the reactive value of the lookup host.
 *
 */
DynamicTemplate.prototype._setLookupHost = function (host) {
  var self = this;

  if (self._lookupHostValue !== host) {
    self._lookupHostValue = host;
    Tracker.afterFlush(function () {
      // if the lookup host changes and the template also changes
      // before the next flush cycle, this gives the new template
      // a chance to render, and the old template to be torn off
      // the page (including stopping its computation) before the
      // lookupHostDep is changed.
      self._lookupHostDep.changed();
    });
  }

  return this;
};

/*****************************************************************************/
/* DynamicTemplate Static Methods */
/*****************************************************************************/

/**
 * Get the first parent data context that are not inclusion arguments
 * (see above function). Note: This function can create reactive dependencies.
 */
DynamicTemplate.getParentDataContext = function (view) {
  // Use view-based traversal which correctly identifies inclusion argument
  // wrappers via __isTemplateWith and skips them.
  //
  // Note: We previously had a Template.parentData fallback here, but it cannot
  // distinguish between real data contexts and inclusion arguments because it
  // only gives us the data, not the view. The view-based traversal in
  // getDataContext() is the proper solution for Blaze 3.0.
  return DynamicTemplate.getDataContext(view && view.parentView);
};

/**
 * Normalize Blaze scope bindings (named/positional args) into usable values.
 * Returns an object for named args, a primitive for a single positional arg,
 * or an array for multiple positional args. Returns null when empty.
 */
DynamicTemplate._normalizeScopeBindings = function (bindings) {
  if (!bindings || typeof bindings !== 'object') return null;

  var keys = Object.keys(bindings);
  if (!keys.length) return null;

  var values = {};
  var positional = [];
  var hasNamed = false;

  _.each(keys, function (key) {
    if (!key) return;
    if (key.charAt(0) === '_') return;

    var value = bindings[key];
    if (typeof value === 'function') {
      try {
        value = value();
      } catch (e) {
        value = undefined;
      }
    }

    if (key === 'hash' && value && typeof value === 'object') {
      _.each(value, function (hashValue, hashKey) {
        values[hashKey] = hashValue;
        hasNamed = true;
      });
      return;
    }

    if (/^\d+$/.test(key)) {
      positional.push(value);
      return;
    }

    values[key] = value;
    hasNamed = true;
  });

  if (hasNamed) return values;
  if (positional.length === 1) return positional[0];
  if (positional.length > 1) return positional;
  return null;
};

DynamicTemplate._isInclusionArgsView = function (view) {
  if (!view) return false;
  // Only __isTemplateWith is a reliable indicator of inclusion args
  // Don't check _scopeBindings as regular {{#with}} views also have them
  return view.__isTemplateWith === true;
};

/**
 * Common set of keys that indicate an object is inclusion arguments
 * rather than a real data context.
 */
DynamicTemplate._inclusionArgKeys = {
  template: true,
  region: true,
  hash: true,
  route: true,
  content: true,
  data: true
};

/**
 * Blaze 3.0 wraps data in { value: ... } objects.
 * This helper unwraps them.
 */
DynamicTemplate._unwrapBlaze3Value = function (data) {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    var keys = Object.keys(data);
    if (keys.length === 1 && keys[0] === 'value') {
      return data.value;
    }
  }
  return data;
};

/**
 * Check if an object looks like inclusion arguments (has template/region/etc keys).
 */
DynamicTemplate._looksLikeInclusionArgs = function (data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  var keys = Object.keys(data);
  var inclusionKeys = DynamicTemplate._inclusionArgKeys;
  return keys.some(function(k) { return inclusionKeys[k]; });
};

/**
 * Helper names that use positional arguments for non-data purposes.
 * These are Iron Router's own helpers where positional args are region names,
 * not data contexts.
 */
DynamicTemplate._positionalArgHelpers = {
  'yield': true,
  'contentFor': true
};

DynamicTemplate._getInclusionArgsFromView = function (view) {
  if (!view) return null;

  // Only check views marked as template inclusion wrappers
  if (view.__isTemplateWith) {
    // Try dataVar first (Blaze 2.x style)
    if (view.dataVar) {
      try {
        var data = view.dataVar.get();

        // Blaze 3.0 wraps inclusion args in { value: ... }
        data = DynamicTemplate._unwrapBlaze3Value(data);

        if (data && typeof data === 'object' && data.hash && typeof data.hash === 'object') {
          return data.hash;
        }
        if (data !== undefined) return data;
      } catch (e) {
        // fall through to scope bindings
      }
    }

    // Try _scopeBindings (Blaze 3.x style) - only for __isTemplateWith views
    var normalized = DynamicTemplate._normalizeScopeBindings(view._scopeBindings);
    if (normalized !== null && normalized !== undefined) return normalized;

    // Try Blaze.getData as last resort for __isTemplateWith views
    if (Blaze && Blaze.getData) {
      try {
        var viewData = Blaze.getData(view);
        if (viewData !== undefined) return viewData;
      } catch (e) {
        // getData might throw
      }
    }
  }

  return null;
};

/**
 * Get the first data context that is not inclusion arguments.
 * In Blaze 3.0, we need to be more careful about identifying what is actual
 * data context vs. what is inclusion arguments wrapper data.
 *
 * This function searches up the view hierarchy for "with" views that contain
 * actual data contexts. It prefers primitives over objects.
 */
DynamicTemplate.getDataContext = function (view) {
  var maxIterations = 30;
  var iterations = 0;
  var current = view;
  var firstValidObject = null;

  // Pre-compute: check if the starting view is inside a helper that uses
  // positional args for non-data purposes (like region names in yield/contentFor)
  var isInsidePositionalArgHelper = false;
  var checkView = view;
  while (checkView) {
    if (DynamicTemplate._positionalArgHelpers[checkView.name]) {
      isInsidePositionalArgHelper = true;
      break;
    }
    checkView = checkView.parentView;
  }

  var inclusionKeys = DynamicTemplate._inclusionArgKeys;

  while (current && iterations < maxIterations) {
    iterations++;

    // Only look at "with" views - they are the ones that set data context
    if (current.name !== 'with') {
      current = current.parentView;
      continue;
    }

    // Check if this view is marked as template inclusion wrapper
    if (DynamicTemplate._isInclusionArgsView(current)) {
      // Peek at the data to determine if it's inclusion args vs real data
      var peekData = null;
      if (current.dataVar) {
        try { peekData = current.dataVar.get(); } catch(e) {}
      }

      // Blaze 3.0 wraps values in { value: ... }
      peekData = DynamicTemplate._unwrapBlaze3Value(peekData);

      // Skip if the data looks like inclusion args (object with template/region/etc keys)
      var isInclusionArgsObject = DynamicTemplate._looksLikeInclusionArgs(peekData);

      // For primitives in __isTemplateWith views:
      // - Inside yield/contentFor: primitives are region names (skip them)
      // - Outside: primitives are likely real data from UI.dynamic (keep them)
      var isPrimitiveArg = false;
      if (typeof peekData !== 'object' || peekData === null) {
        isPrimitiveArg = isInsidePositionalArgHelper;
      }

      if (isInclusionArgsObject || isPrimitiveArg) {
        current = current.parentView;
        continue;
      }
    }

    // Get data from this "with" view's dataVar
    var data = null;
    if (current.dataVar) {
      try {
        data = current.dataVar.get();
      } catch (e) {
        data = null;
      }
    }

    // Skip null/undefined
    if (data === null || data === undefined) {
      current = current.parentView;
      continue;
    }

    // Blaze 3.0 wraps data context in { value: ... }
    data = DynamicTemplate._unwrapBlaze3Value(data);

    // Skip null/undefined after unwrapping
    if (data === null || data === undefined) {
      current = current.parentView;
      continue;
    }

    // If it's a primitive, return immediately - this is definitely data
    if (typeof data !== 'object') {
      return data;
    }

    // Skip arrays
    if (Array.isArray(data)) {
      current = current.parentView;
      continue;
    }

    // Check if object looks like inclusion arguments or internal Blaze objects
    var keys = Object.keys(data);
    var hasInclusionKey = keys.some(function (key) {
      return inclusionKeys[key];
    });
    var allInclusionLike = keys.every(function (key) {
      return inclusionKeys[key] || key.charAt(0) === '_';
    });
    if (hasInclusionKey && allInclusionLike) {
      current = current.parentView;
      continue;
    }

    // Skip empty objects
    if (keys.length === 0) {
      current = current.parentView;
      continue;
    }

    // Skip objects that only have underscore-prefixed keys (internal Blaze/Meteor objects)
    var hasPublicKeys = keys.some(function(key) {
      return key.charAt(0) !== '_';
    });
    if (!hasPublicKeys) {
      current = current.parentView;
      continue;
    }

    // This is a valid object data context
    // Save it but keep searching - we prefer primitives
    if (firstValidObject === null) {
      firstValidObject = data;
    }

    current = current.parentView;
  }

  // Return first valid object if no primitive was found
  return firstValidObject;
};

/**
 * Get inclusion arguments, if any, from a view.
 *
 * Uses the __isTemplateWith property set when a parent view is used
 * specifically for a data context with inclusion args.
 *
 * Inclusion arguments are arguments provided in a template like this:
 * {{> yield "inclusionArg"}}
 * or
 * {{> yield region="inclusionArgValue"}}
 */
DynamicTemplate.getInclusionArguments = function (view) {
  var current = view;
  var maxDepth = 15;
  var depth = 0;

  while (current && depth < maxDepth) {
    var args = DynamicTemplate._getInclusionArgsFromView(current);
    if (args !== null && args !== undefined) {
      return args;
    }

    current = current.parentView;
    depth++;
  }

  // Fallback: check Blaze.getData on the original view for block helpers
  // like {{#contentFor "footer"}} where "footer" is the data context
  if (Blaze && Blaze.getData) {
    try {
      var viewData = Blaze.getData(view);
      // Only return strings (positional args) or objects with inclusion keys
      if (typeof viewData === 'string') {
        return viewData;
      }
      if (viewData && typeof viewData === 'object' && !Array.isArray(viewData)) {
        if (viewData.hasOwnProperty('template') || viewData.hasOwnProperty('region') ||
            viewData.hasOwnProperty('data') || viewData.hasOwnProperty('route')) {
          return viewData;
        }
      }
    } catch (e) {
      // getData might throw
    }
  }

  return null;
};

/**
 * Given a view, return a function that can be used to access argument values at
 * the time the view was rendered. There are two key benefits:
 *
 * 1. Save the argument data at the time of rendering. When you use lookup(...)
 *    it starts from the current data context which can change.
 * 2. Defer creating a dependency on inclusion arguments until later.
 *
 * Example:
 *
 *   {{> MyTemplate template="MyTemplate"
 *   var args = DynamicTemplate.args(view);
 *   var tmplValue = args('template');
 *     => "MyTemplate"
 */
DynamicTemplate.args = function (view) {
  var cached = false;
  var data;

  return function (key) {
    if (!cached) {
      data = Tracker.nonreactive(function () {
        return DynamicTemplate.getInclusionArguments(view);
      });

      // snapshot object args to avoid later mutation
      if (data && typeof data === 'object') {
        data = _.clone(data);
      }

      cached = true;
    }

    if (!data) return null;

    if (key)
      return data[key];
    else
      return data;
  };
};

/**
 * Inherit from DynamicTemplate.
 */
DynamicTemplate.extend = function (props) {
  return Iron.utils.extend(this, props);
};

DynamicTemplate.findFirstLookupHost = function (view) {
  var host;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  // Fast nonreactive scan first
  var current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: false });
      if (host) return host;
    }
    current = current.parentView;
  }

  // Only establish reactive deps if we're in a reactive computation
  if (!Tracker.active) {
    return undefined;
  }

  current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: true });
      if (host) return host;
    }
    current = current.parentView;
  }

  return undefined;
};

DynamicTemplate.findLookupHostWithProperty = function (view, key) {
  var host;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  // Fast nonreactive scan first (no deps on every lookup)
  var current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: false });
      if (host && get(host, key)) {
        return host;
      }
    }
    current = current.parentView;
  }

  // Only establish reactive deps if we're in a reactive computation
  if (!Tracker.active) {
    return undefined;
  }

  current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: true });
      if (host && get(host, key)) {
        return host;
      }
    }
    current = current.parentView;
  }

  return undefined;
};

/**
 * Find a lookup host that has a given helper and returns the host.
 * Uses a non-reactive fast path first to avoid creating dependency chains
 * on every lookup, then establishes reactive deps only when in a computation.
 */
DynamicTemplate.findLookupHostWithHelper = function (view, helperKey) {
  var host;
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  // Fast nonreactive scan first (no deps on every lookup)
  var current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: false });
      if (host && get(host, 'constructor', '_helpers', helperKey)) {
        return host;
      }
    }
    current = current.parentView;
  }

  // Only establish reactive deps if we're in a reactive computation
  if (!Tracker.active) {
    return undefined;
  }

  current = view;
  while (current) {
    if (current.__dynamicTemplate__) {
      host = current.__dynamicTemplate__._getLookupHost({ reactive: true });
      if (host && get(host, 'constructor', '_helpers', helperKey)) {
        return host;
      }
    }
    current = current.parentView;
  }

  return undefined;
};

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  UI.registerHelper('DynamicTemplate', new Template('DynamicTemplateHelper', function () {
    var view = this;

    // Helper to get a specific inclusion argument by key
    var getArg = function(key) {
      var value = null;

      // Try using view.lookup if available (Blaze's lookup mechanism)
      if (key && view.lookup) {
        try {
          var lookupResult = view.lookup(key);
          if (typeof lookupResult === 'function') {
            value = lookupResult();
          } else {
            value = lookupResult;
          }
          if (value !== undefined) return value;
        } catch (e) {
          // lookup might throw, continue to other methods
        }
      }

      // Try getInclusionArguments (searches parent views for inclusion args object)
      var args = DynamicTemplate.getInclusionArguments(view);
      if (args && typeof args === 'object' && args.hasOwnProperty(key)) {
        return args[key];
      }

      return undefined;
    };

    // Get the template argument - this is required for the helper to work
    var templateArg = function() {
      return getArg('template');
    };

    // Get the data argument - if not provided, return undefined to inherit parent data
    var dataArg = function() {
      var data = getArg('data');
      // Only return if data was explicitly provided
      // If data is undefined, DynamicTemplate will inherit parent data context
      return data;
    };

    return new DynamicTemplate({
      data: dataArg,
      template: templateArg,
      content: view.templateContentBlock
    }).create();
  }));
}

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
export { DynamicTemplate };
Iron.DynamicTemplate = DynamicTemplate;
