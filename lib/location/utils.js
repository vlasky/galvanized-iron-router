import { Url } from '../url/url.js';

const HASH_PARAM_NAME='__hash__';

/**
 * Given:
 *   http://host:port/some/pathname/?query=string#bar
 *
 * Return:
 *   http://host:port#!some/pathname/?query=string&__hash__=bar
 */
const urlToHashStyle = function (url) {
  const parts = Url.parse(url);
  let hash = parts.hash && parts.hash.replace('#', '');
  let search = parts.search;
  const pathname = parts.pathname;
  const root = parts.rootUrl;

  // do we have another hash value that isn't a path?
  if (hash && hash.charAt(0) !== '!') {
    const hashQueryString = HASH_PARAM_NAME + '=' + hash;
    search = search ? (search + '&') : '?';
    search += hashQueryString;
    hash = '';
  }

  // if we don't already have a path on the hash create one
  if (! hash && pathname) {
    hash = '#!' + pathname.substring(1);
  } else if (hash) {
    hash = '#' + hash;
  }

  return [
    root,
    hash,
    search
  ].join('');
};

/**
 * Given a url that uses the hash style (see above), return a new url that uses
 * the hash path as a normal pathname.
 *
 * Given:
 *   http://host:port#!some/pathname/?query=string&__hash__=bar
 *
 * Return:
 *   http://host:port/some/pathname/?query=string#bar
 */
const urlFromHashStyle = function (url) {
  const parts = Url.parse(url);
  const pathname = parts.hash && parts.hash.replace('#!', '/');
  const root = parts.rootUrl;
  let hash;

  // see if there's a __hash__=value in the query string in which case put it
  // back in the normal hash position and delete it from the search string.
  if (Object.prototype.hasOwnProperty.call(parts.queryObject, HASH_PARAM_NAME)) {
    hash = '#' + parts.queryObject[HASH_PARAM_NAME];
    delete parts.queryObject[HASH_PARAM_NAME];
  } else {
    hash = '';
  }

  return [
    root,
    pathname,
    Url.toQueryString(parts.queryObject),
    hash
  ].join('');
};

/**
 * Fix up a pathname intended for use with a hash path by moving any hash
 * fragments into the query string.
 */
const fixHashPath = function (pathname) {
  const parts = Url.parse(pathname);
  const query = parts.queryObject;

  // if there's a hash in the path move that to the query string
  if (parts.hash) {
    query[HASH_PARAM_NAME] = parts.hash.replace('#', '')
  }

  return [
    '!',
    parts.pathname.substring(1),
    Url.toQueryString(query)
  ].join('');
};

export { urlToHashStyle, urlFromHashStyle, fixHashPath };
