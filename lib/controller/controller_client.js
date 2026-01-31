import { ReactiveDict } from 'meteor/reactive-dict';
import { _ } from 'meteor/underscore';
import { Controller } from './controller.js';
import { WaitList } from './wait_list.js';

/*****************************************************************************/
/* Controller Client */
/*****************************************************************************/
/**
 * Client specific init code.
 */
Controller.prototype.init = function (options) {
  this._waitlist = new WaitList;
  this.state = new ReactiveDict;
};

/**
 * Insert the controller's layout into the DOM.
 */
Controller.prototype.insert = function (options) {
  return this._layout.insert.apply(this._layout, arguments);
};

/**
 * Add an item to the waitlist.
 */
Controller.prototype.wait = function (fn) {
  if (!fn)
    // it's possible fn is just undefined but we'll just return instead
    // of throwing an error, to make it easier to call this function
    // with waitOn which might not return anything.
    return;

  if (_.isArray(fn)) {
    _.each(fn, (fnOrHandle) => {
      this.wait(fnOrHandle);
    });
  } else if (fn.ready) {
    this._waitlist.wait(() => fn.ready());
  } else {
    this._waitlist.wait(fn);
  }

  return this;
};

/**
 * Returns true if all items in the waitlist are ready.
 */
Controller.prototype.ready = function () {
  return this._waitlist.ready();
};

/**
 * Clean up the controller and stop the waitlist.
 */
Controller.prototype.stop = function () {
  this._waitlist.stop();
};
