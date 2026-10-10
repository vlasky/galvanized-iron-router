/*
Based on https://github.com/pillarjs/path-to-regexp

The MIT License (MIT)

Copyright (c) 2014 Blake Embrey (hello@blakeembrey.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const typeOf = function (o) { return Object.prototype.toString.call(o); };

/**
 * The main path tokenising regexp.
 *
 * @type {RegExp}
 */
const PATH_REGEXP = new RegExp([
  // Match already escaped characters that would otherwise incorrectly appear
  // in future matches. This allows the user to escape special characters that
  // shouldn't be transformed.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
  // "/route(\\d+)" => [undefined, undefined, undefined, "\d+", undefined]
  '([\\/.])?(?:\\:(\\w+)(?:\\(((?:\\\\.|[^)])*)\\))?|\\(((?:\\\\.|[^)])*)\\))([+*?])?',
  // Match a bare asterisk: a positional catch-all, as in Express 4 and the
  // original Iron Router ("/files/*"). Escape it ("\\*") for a literal star.
  '(\\*)'
].join('|'), 'g');

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1');
}

/**
 * Escape the literal text of a pattern for the regexp, leaving backslash
 * escapes ("\*", "\d") as they are: they reach the regexp verbatim, so an
 * escaped special is a literal and an escaped letter keeps its regexp meaning,
 * exactly as the original single-pass compiler behaved.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeLiteral (str) {
  return str.replace(/\\(.)|([.+*?=^!:${}()[\]|/])/g, (match, escaped, special) => {
    return escaped !== undefined ? match : '\\' + special;
  });
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$/()])/g, '\\$1');
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
const attachKeys = function (re, keys) {
  /** @type {any} */ (re).keys = keys;

  return re;
};

/**
 * Parse a path pattern into tokens: literal strings and parameter objects
 * `{name, prefix, delimiter, optional, repeat, asterisk, pattern}`. The
 * matcher (tokensToRegExp) and Url#resolve are both built from these tokens,
 * so what one accepts the other can produce.
 *
 * @param  {String} str
 * @return {Array<String|Object>}
 */
function parse (str) {
  const tokens = [];
  let key = 0;
  let index = 0;
  let path = '';
  let res;

  PATH_REGEXP.lastIndex = 0;

  while ((res = PATH_REGEXP.exec(str)) != null) {
    const m = res[0];
    const escaped = res[1];
    const offset = res.index;
    path += str.slice(index, offset);
    index = offset + m.length;

    // Keep escaped sequences in the literal text as they are; see
    // escapeLiteral (matching) and Url#resolve (generation).
    if (escaped) {
      path += escaped;
      continue;
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path);
      path = '';
    }

    const prefix = res[2];
    const name = res[3];
    const capture = res[4];
    const group = res[5];
    const suffix = res[6];
    const asterisk = res[7];

    const repeat = suffix === '+' || suffix === '*';
    const optional = suffix === '?' || suffix === '*';
    const delimiter = prefix || '/';
    const pattern = capture || group;

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      asterisk: !!asterisk,
      // Match using the custom capturing group, or fall back to capturing
      // everything up to the next delimiter (slash, or period for a
      // period-prefixed param); an asterisk captures everything. escapeGroup
      // runs over the default capture as well, as it always did: for a slash
      // delimiter that yields [^\\/]+?, which also excludes a backslash.
      pattern: escapeGroup(pattern || (asterisk ? '.*' : '[^' + escapeString(delimiter) + ']+?'))
    });
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index);
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path);
  }

  return tokens;
}

/**
 * Build the matching regexp from a token list.
 *
 * @param  {Array}  tokens
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  const strict = options.strict;
  const end = options.end !== false;
  const flags = options.sensitive ? '' : 'i';
  let route = '';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (typeof token === 'string') {
      route += escapeLiteral(token);
      continue;
    }

    const prefix = escapeString(token.prefix);
    let capture = token.pattern;

    // Allow parameters to be repeated more than once.
    if (token.repeat) {
      capture += '(?:' + prefix + capture + ')*';
    }

    // Allow a parameter to be optional (prefix included).
    if (token.optional) {
      route += '(?:' + prefix + '(' + capture + '))?';
    } else {
      route += prefix + '(' + capture + ')';
    }
  }

  // Check whether the path ends in a slash as it alters some match behaviour.
  const endsWithSlash = route.slice(-2) === '\\/';

  // In non-strict mode we allow an optional trailing slash in the match. If
  // the path to match already ended with a slash, we need to remove it for
  // consistency. The slash is only valid at the very end of a path match, not
  // anywhere in the middle. This is important for non-ending mode, otherwise
  // "/test/" will match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?';
  }

  // In non-ending mode, we need prompt the capturing groups to match as much
  // as possible by using a positive lookahead for the end or next path segment.
  if (!end) {
    route += strict && endsWithSlash ? '' : '(?=\\/|$)';
  }

  return new RegExp('^' + route + (end ? '$' : ''), flags);
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array should be passed in, which will contain the placeholder key
 * names. For example `/user/:id` will then contain `["id"]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 keys
 * @param  {Object}                options
 * @return {RegExp}
 */
function pathtoRegexp (path, keys, options) {
  if (keys && typeOf(keys) !== '[object Array]') {
    options = keys;
    keys = null;
  }

  keys = keys || [];
  options = options || {};

  if (path instanceof RegExp) {
    // Match all capturing groups of a regexp.
    const groups = path.source.match(/\((?!\?)/g) || [];

    // Map all the matches to their numeric keys and push into the keys.
    keys.push.apply(keys, groups.map((match, index) => {
      return {
        name:      index,
        delimiter: null,
        optional:  false,
        repeat:    false
      };
    }));

    // Return the source back to the user.
    return attachKeys(path, keys);
  }

  if (typeOf(path) === '[object Array]') {
    // Map array parts into regexps and return their source. We also pass
    // the same keys and options instance into every generation to get
    // consistent matching groups before we join the sources together.
    const pathArray = /** @type {any[]} */ (path);
    const parts = pathArray.map((value) => {
      return pathtoRegexp(value, keys, options).source;
    });

    // Generate a new regexp instance by joining all the parts together.
    const flags = options.sensitive ? '' : 'i';
    return attachKeys(new RegExp('(?:' + parts.join('|') + ')', flags), keys);
  }

  // At this point, path must be a string (RegExp and Array cases returned above)
  const tokens = parse(/** @type {string} */ (path));

  tokens.forEach((token) => {
    if (typeof token !== 'string') {
      keys.push({
        name:      token.name,
        delimiter: token.delimiter,
        optional:  token.optional,
        repeat:    token.repeat
      });
    }
  });

  return attachKeys(tokensToRegExp(tokens, options), keys);
};

const compilePath = pathtoRegexp;

export { compilePath, parse };
