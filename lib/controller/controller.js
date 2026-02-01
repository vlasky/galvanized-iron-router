import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { Iron } from '../core/iron_core.js';
import { Layout } from '../layout/layout.js';
import { DynamicTemplate } from '../dynamic-template/dynamic_template.js';

/*****************************************************************************/
/* Imports */
/*****************************************************************************/

/*****************************************************************************/
/* Private */
/*****************************************************************************/
const bindData = function (value, thisArg) {
  return function () {
    return (typeof value === 'function') ? value.apply(thisArg, arguments) : value;
  };
};

/**
 * Returns a single event map merged from super to child.
 * Called from the constructor function like this:
 *
 * this.constructor._collectEventMaps()
 */
const mergeStaticInheritedObjectProperty = function (ctor, prop) {
  let merge = {};

  if (ctor.__super__)
    Object.assign(merge, mergeStaticInheritedObjectProperty(ctor.__super__.constructor, prop));

  return Object.prototype.hasOwnProperty.call(ctor, prop) ?
    Object.assign(merge, ctor[prop]) : merge;
};

/*****************************************************************************/
/* Controller */
/*****************************************************************************/
class Controller {
  /**
   * @type {Object}
   */
  options;

  /**
   * @type {Layout}
   */
  _layout;

  /**
   * @type {boolean}
   */
  _isController;

  /**
   * @type {import('./wait_list.js').WaitList}
   */
  _waitlist;

  /**
   * @type {import('meteor/reactive-dict').ReactiveDict}
   */
  state;

  constructor(options) {
    this.options = options || {};
    this._layout = this.options.layout || new Layout(this.options);
    this._isController = true;
    this._layout._setLookupHost(this);

    // grab the event map from the Controller constructor which was
    // set if the user does MyController.events({...});
    const eventMap = Controller._collectEventMaps.call(this.constructor);
    this._layout.events(eventMap, this);

    this.init(options);
  }

  /**
   * Set or get the layout's template and optionally its data context.
   */
  layout(template, options) {
    this._layout.template(template);

    // check whether options has a data property
    if (options && (Object.prototype.hasOwnProperty.call(options, 'data')))
      this._layout.data(bindData(options.data, this));

    return {
      data: (val) => {
        return this._layout.data(bindData(val, this));
      }
    };
  }

  /**
   * Render a template into a region of the layout.
   */
  render(template, options) {
    if (options && (typeof options.data !== 'undefined'))
      options.data = bindData(options.data, this);

    const tmpl = this._layout.render(template, options);

    // allow caller to do: this.render('MyTemplate').data(function () {...});
    return {
      data: (func) => {
        return tmpl.data(bindData(func, this));
      }
    };
  }

  /**
   * Begin recording rendered regions.
   */
  beginRendering(onComplete) {
    return this._layout.beginRendering(onComplete);
  }

  /**
   * Initialize the controller. Override in client/server specific code.
   * @param {Object} [options]
   */
  init(options) {}

  /**
   * Add an item to the waitlist. Implemented in controller_client.js.
   * @param {Function|Array} [fn]
   * @returns {Controller|undefined}
   */
  wait(fn) { return this; }

  /**
   * Returns true if all items in the waitlist are ready. Implemented in controller_client.js.
   * @returns {boolean}
   */
  ready() { return true; }

  /**
   * Clean up the controller. Implemented in controller_client.js.
   */
  stop() {}

  /**
   * Insert the controller's layout into the DOM. Implemented in controller_client.js.
   * @param {Object} [options]
   */
  insert(options) {}

  /*****************************************************************************/
  /* Controller Static Methods */
  /*****************************************************************************/
  /**
   * Inherit from Controller.
   *
   * Note: The inheritance function in Meteor._inherits is broken. Static
   * properties on functions don't get copied.
   */
  static extend(props) {
    return Iron.utils.extend(this, props);
  }

  static events(events) {
    this._eventMap = events;
    return this;
  }

  static _collectEventMaps() {
    return mergeStaticInheritedObjectProperty(this, '_eventMap');
  }

  static helpers(helpers) {
    Object.assign(this._helpers, helpers);
    return this;
  }
}

// NOTE: helpers are not inherited from one controller to another, for now.
Controller._helpers = {};

/*****************************************************************************/
/* Global Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  /**
   * Returns the nearest controller for a template instance. You can call this
   * function from inside a template helper.
   *
   * Example:
   * Template.MyPage.helpers({
   *   greeting: function () {
   *    var controller = Iron.controller();
   *    return controller.state.get('greeting');
   *   }
   * });
   */
  Iron.controller = function () {
    //XXX establishes a reactive dependency which causes helper to run
    return DynamicTemplate.findLookupHostWithProperty(Blaze.getView(), '_isController');
  };

  /**
   * Find a lookup host with a state key and return it reactively if we have
   * it.
   */
  Template.registerHelper('get', function (key) {
    const controller = Iron.controller();
    if (controller && controller.state)
      return controller.state.get(key);
  });
}
/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
export { Controller };

Iron.Controller = Controller;
