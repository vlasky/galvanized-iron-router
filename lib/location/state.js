import { _ } from 'meteor/underscore';
import { Url } from '../url/url.js';

class State {
  /** @type {string} */
  rootUrl;
  /** @type {string} */
  originalUrl;
  /** @type {string} */
  href;
  /** @type {string} */
  protocol;
  /** @type {string} */
  auth;
  /** @type {string} */
  host;
  /** @type {string} */
  hostname;
  /** @type {string} */
  port;
  /** @type {string} */
  origin;
  /** @type {string} */
  path;
  /** @type {string} */
  pathname;
  /** @type {string} */
  search;
  /** @type {string} */
  query;
  /** @type {Object} */
  queryObject;
  /** @type {string} */
  hash;
  /** @type {boolean} */
  slashes;
  /** @type {Object} */
  options;
  /** @type {boolean} */
  _isCancelled;

  constructor(url, options) {
    _.extend(this, Url.parse(url), {options: options || {}});
  }

  // XXX: should this compare options (e.g. history.state?)
  equals(other) {
    if (!other)
      return false;

    if (!(other instanceof State))
      return false;

    if (other.pathname == this.pathname &&
       other.search == this.search &&
       other.hash == this.hash &&
       other.options.historyState === this.options.historyState)
      return true;

    return false;
  }

  isCancelled() {
    return !!this._isCancelled;
  }

  cancelUrlChange() {
    this._isCancelled = true;
  }
}

export { State };
