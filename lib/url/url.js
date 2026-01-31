import { _ } from 'meteor/underscore';
import { Iron } from '../core/iron_core.js';
import { compilePath } from './compiler.js';

/*****************************************************************************/
/* Imports */
/*****************************************************************************/
const warn = Iron.utils.warn;

/*****************************************************************************/
/* Url */
/*****************************************************************************/
function safeDecodeURIComponent (val) {
  try {
    return decodeURIComponent(val.replace(/\+/g, ' '));
  } catch (e) {
    if (e.constructor == URIError) {
      warn("Tried to decode an invalid URI component: " + JSON.stringify(val) + " " + e.stack);
    }

    return undefined;
  }
}

function safeDecodeURI (val) {
  try {
    return decodeURI(val.replace(/\+/g, ' '));
  } catch (e) {
    if (e.constructor == URIError) {
      warn("Tried to decode an invalid URI: " + JSON.stringify(val) + " " + e.stack);
    }

    return undefined;
  }
}

/**
 * Url utilities and the ability to compile a url into a regular expression.
 */
class Url {
  /** @type {Object} */
  options;
  /** @type {Array} */
  keys;
  /** @type {RegExp} */
  regexp;
  /** @type {string|RegExp} */
  _originalPath;
  // Properties from Url.parse()
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
  /** @type {string} */
  name;

  constructor(url, options) {
    options = options || {};
    this.options = options;
    this.keys = [];
    this.regexp = compilePath(url, this.keys, options);
    this._originalPath = url;
    _.extend(this, Url.parse(url));
  }

  /**
   * Returns true if the path matches and false otherwise.
   */
  test(path) {
    return this.regexp.test(/** @type {string} */ (Url.normalize(path)));
  }

  /**
   * Returns the result of calling exec on the compiled path with
   * the given path.
   */
  exec(path) {
    return this.regexp.exec(/** @type {string} */ (Url.normalize(path)));
  }

  /**
   * Returns an array of parameters given a path. The array may have named
   * properties in addition to indexed values.
   */
  params(path) {
    if (!path)
      return [];

    /** @type {Array & { hash?: string | null, query?: Object, [key: string]: any }} */
    const params = /** @type {any} */ ([]);
    const m = this.exec(path);
    let queryString;
    const keys = this.keys;

    if (!m)
      throw new Error('The route named "' + this.name + '" does not match the path "' + path + '"');

    for (let i = 1, len = m.length; i < len; ++i) {
      const key = keys[i - 1];
      const value = typeof m[i] == 'string' ? safeDecodeURIComponent(m[i]) : m[i];
      if (key) {
        params[key.name] = params[key.name] !== undefined ?
          params[key.name] : value;
      } else
        params.push(value);
    }

    if (typeof safeDecodeURI(path) !== 'undefined') {
      queryString = path.split('?')[1];
      if (queryString)
        queryString = queryString.split('#')[0];

      params.hash = path.split('#')[1] || null;
      params.query = Url.fromQueryString(queryString);
    }

    return params;
  }

  resolve(params, options) {
    let value;
    let isValueDefined;
    let wildCardCount = 0;
    let path = this._originalPath;
    let hash;
    let query;
    const missingParams = [];
    const originalParams = params;

    options = options || {};
    params = params || [];
    query = options.query;
    hash = options.hash && options.hash.toString();

    if (path instanceof RegExp) {
      throw new Error('Cannot currently resolve a regular expression path');
    } else {
      path = path
        .replace(
          /(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g,
          function (match, slash, format, key, capture, optional, offset) {
            slash = slash || '';
            format = format || '';
            value = params[key];
            isValueDefined = typeof value !== 'undefined';

            if (optional && !isValueDefined) {
              value = '';
            } else if (!isValueDefined) {
              missingParams.push(key);
              return;
            }

            value = _.isFunction(value) ? value.call(params) : value;
            const escapedValue = _.map(String(value).split('/'), (segment) => {
              return encodeURIComponent(segment);
            }).join('/');
            return slash + format + escapedValue;
          }
        )
        .replace(
          /\*/g,
          function (match) {
            if (typeof params[wildCardCount] === 'undefined') {
              throw new Error(
                'You are trying to access a wild card parameter at index ' +
                wildCardCount +
                ' but the value of params at that index is undefined');
            }

            const paramValue = String(params[wildCardCount++]);
            return _.map(paramValue.split('/'), (segment) => {
              return encodeURIComponent(segment);
            }).join('/');
          }
        );

      query = Url.toQueryString(query);

      path = path + query;

      if (hash) {
        hash = encodeURI(hash.replace('#', ''));
        path = path + '#' + hash;
      }
    }

    // Because of optional possibly empty segments we normalize path here
    path = path.replace(/\/+/g, '/'); // Multiple / -> one /
    path = path.replace(/^(.+)\/$/g, '$1'); // Removal of trailing /

    if (missingParams.length == 0)
      return path;
    else if (options.throwOnMissingParams === true)
      throw new Error("Missing required parameters on path " + JSON.stringify(this._originalPath) + ". The missing params are: " + JSON.stringify(missingParams) + ". The params object passed in was: " + JSON.stringify(originalParams) + ".");
    else
      return null;
  }

  /**
   * Given a relative or absolute path return
   * a relative path with a leading forward slash and
   * no search string or hash fragment
   *
   * @param {String|RegExp} url
   * @return {String|RegExp}
   */
  static normalize(url) {
    if (url instanceof RegExp)
      return url;
    else if (typeof url !== 'string')
      return '/';

    const parts = Url.parse(url);
    let pathname = parts.pathname;

    if (pathname.charAt(0) !== '/')
      pathname = '/' + pathname;

    if (pathname.length > 1 && pathname.charAt(pathname.length - 1) === '/') {
      pathname = pathname.slice(0, pathname.length - 1);
    }

    return pathname;
  }

  /**
   * Returns true if both a and b are of the same origin.
   */
  static isSameOrigin(a, b) {
    const aParts = Url.parse(a);
    const bParts = Url.parse(b);
    const result = aParts.origin === bParts.origin;
    return result;
  }

  /**
   * Given a query string return an object of key value pairs.
   *
   * "?p1=value1&p2=value2 => {p1: value1, p2: value2}
   */
  static fromQueryString(query) {
    if (!query)
      return {};

    if (typeof query !== 'string')
      throw new Error("expected string");

    // get rid of the leading question mark
    if (query.charAt(0) === '?')
      query = query.slice(1);

    const keyValuePairs = query.split('&');
    const result = {};

    _.each(keyValuePairs, (pair) => {
      const parts = pair.split('=');
      let key = safeDecodeURIComponent(parts[0]);
      const value = safeDecodeURIComponent(parts[1]);

      if (typeof key !== 'undefined' &&
          typeof value !== 'undefined' &&
          key.slice(-2) === '[]') {
        key = key.slice(0, -2);
        result[key] = result[key] || [];
        result[key].push(value);
      } else {
        result[key] = value;
      }
    });

    return result;
  }

  /**
   * Given a query object return a query string.
   */
  static toQueryString(queryObject) {
    const result = [];

    if (typeof queryObject === 'string') {
      if (queryObject.charAt(0) !== '?')
        return '?' + queryObject;
      else
        return queryObject;
    }

    _.each(queryObject, (value, key) => {
      if (_.isArray(value)) {
        _.each(value, (valuePart) => {
          result.push(encodeURIComponent(key) + '[]=' + encodeURIComponent(valuePart));
        });
      } else {
        result.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      }
    });

    // no sense in adding a pointless question mark
    if (result.length > 0)
      return '?' + result.join('&');
    else
      return '';
  }

  /**
   * Given a string url return an object with all of the url parts.
   */
  static parse(url) {
    if (typeof url !== 'string')
      return {};

    //http://tools.ietf.org/html/rfc3986#page-50
    //http://www.rfc-editor.org/errata_search.php?rfc=3986
    const re = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/;

    const match = url.match(re);

    const protocol = match[1] ? match[1].toLowerCase() : undefined;
    const hostWithSlashes = match[3];
    const slashes = !!hostWithSlashes;
    const hostWithAuth= match[4] ? match[4].toLowerCase() : undefined;
    const hostWithAuthParts = hostWithAuth ? hostWithAuth.split('@') : [];

    let host, auth;

    if (hostWithAuthParts.length == 2) {
      auth = hostWithAuthParts[0];
      host = hostWithAuthParts[1];
    } else if (hostWithAuthParts.length == 1) {
      host = hostWithAuthParts[0];
      auth = undefined;
    } else {
      host = undefined;
      auth = undefined;
    }

    const hostWithPortParts = (host && host.split(':')) || [];
    const hostname = hostWithPortParts[0];
    const port = hostWithPortParts[1];
    const origin = (protocol && host) ? protocol + '//' + host : undefined;
    const pathname = match[5];
    let hash = match[8];

    let search = match[6];

    let query;
    const indexOfSearch = (hash && hash.indexOf('?')) || -1;

    // if we found a search string in the hash and there is no explicit search
    // string
    if (~indexOfSearch && !search) {
      search = hash.slice(indexOfSearch);
      hash = hash.substr(0, indexOfSearch);
      // get rid of the ? character
      query = search.slice(1);
    } else {
      query = match[7];
    }

    const path = pathname + (search || '');
    const queryObject = Url.fromQueryString(query);

    const rootUrl = [
      protocol || '',
      slashes ? '//' : '',
      hostWithAuth || ''
    ].join('');

    const href = [
      protocol || '',
      slashes ? '//' : '',
      hostWithAuth || '',
      pathname || '',
      search || '',
      hash || ''
    ].join('');

    return {
      rootUrl: rootUrl || '',
      originalUrl: url || '',
      href: href || '',
      protocol: protocol || '',
      auth: auth || '',
      host: host || '',
      hostname: hostname || '',
      port: port || '',
      origin: origin || '',
      path: path || '',
      pathname: pathname || '',
      search: search || '',
      query: query || '',
      queryObject: queryObject || '',
      hash: hash || '',
      slashes: slashes
    };
  }
}

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
export { Url };
Iron.Url = Url;
