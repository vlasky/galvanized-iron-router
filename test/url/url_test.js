var Url = Iron.Url;

Tinytest.add('Url - parse', function (test) {
  var url;
  var parts;

  url = 'http://localhost.com:3000/page1/?query=string#hashfrag';
  parts = Url.parse(url);
  test.equal(parts.href, url);
  test.equal(parts.protocol, 'http:');
  test.equal(parts.host, 'localhost.com:3000');
  test.equal(parts.hostname, 'localhost.com');
  test.equal(parts.port, '3000');
  test.equal(parts.origin, 'http://localhost.com:3000');
  test.equal(parts.pathname, '/page1/');
  test.equal(parts.path, '/page1/?query=string', url);
  test.equal(parts.search, '?query=string', url);
  test.equal(parts.query, 'query=string', url);
  test.equal(parts.hash, '#hashfrag');

  url = '/page1?query=string#hashfrag';
  parts = Url.parse(url);
  test.equal(parts.href, url);
  test.equal(parts.protocol, '');
  test.equal(parts.host, '');
  test.equal(parts.hostname, '');
  test.equal(parts.port, '');
  test.equal(parts.origin, '');
  test.equal(parts.pathname, '/page1');
  test.equal(parts.path, '/page1?query=string');
  test.equal(parts.search, '?query=string');
  test.equal(parts.query, 'query=string');
  test.equal(parts.hash, '#hashfrag');

  url = 'http://user:pass@localhost.com:3000/page1/?query=string#hashfrag';
  parts = Url.parse(url);
  test.equal(parts.auth, 'user:pass');
  test.equal(parts.href, url);
  test.equal(parts.protocol, 'http:');
  test.equal(parts.host, 'localhost.com:3000');
  test.equal(parts.hostname, 'localhost.com');
  test.equal(parts.port, '3000');
  test.equal(parts.origin, 'http://localhost.com:3000');
  test.equal(parts.pathname, '/page1/');
  test.equal(parts.path, '/page1/?query=string', url);
  test.equal(parts.search, '?query=string', url);
  test.equal(parts.query, 'query=string', url);
  test.equal(parts.hash, '#hashfrag', url);
});

Tinytest.add('Url - normalize', function (test) {
  var url;

  url = '/items';
  test.equal(Url.normalize(url), '/items');

  url = '/items/';
  test.equal(Url.normalize(url), '/items');

  url = '/items/?query=string';
  test.equal(Url.normalize(url), '/items');

  url = '/items?query=string';
  test.equal(Url.normalize(url), '/items');
});

var paths = {
  explicit: '/posts',
  required: '/posts/:param',
  multi: '/posts/:paramOne/:paramTwo',
  optional: '/posts/:paramOne/:paramTwo?',
  simpleOptional: '/:param?',
  twoOptional: '/:paramOne?/:paramTwo?',
  mixedOptional: '/:paramOne?/:paramTwo/:paramThree?',
  wildcard: '/posts/(*)',
  namedWildcard: '/posts/:file(*)',
  regex: /^\/commits\/(\d+)\.\.(\d+)/
};

Tinytest.add('Url - matching and params', function (test) {
  var path = new Url(paths.explicit);
  test.isTrue(path.test('/posts'));
  test.isTrue(path.exec('/posts'));
  test.isTrue(path.test('/posts/'));
  test.isFalse(path.test('/posts/1'));
  test.isNull(path.exec('/posts/1'));

  path = new Url(paths.multi);
  test.isTrue(path.test('/posts/1/2'));
  test.isTrue(path.exec('/posts/1/2'));
  test.isTrue(path.test('/posts/1/2/'));
  test.isTrue(path.exec('/posts/1/2/'));
  test.isFalse(path.test('/posts/1/2/3'));
  test.isNull(path.exec('/posts/1/2/3'));

  path = new Url(paths.optional);
  test.isTrue(path.test('/posts/1'));
  test.isTrue(path.exec('/posts/1'));
  test.isTrue(path.test('/posts/1/2'));
  test.isTrue(path.exec('/posts/1/2'));
  test.isTrue(path.test('/posts/1/2/'));
  test.isTrue(path.exec('/posts/1/2/'));
  test.isFalse(path.test('/posts/1/2/3'));
  test.isNull(path.exec('/posts/1/2/3'));

  path = new Url(paths.simpleOptional);
  test.isTrue(path.test('/'));
  test.isTrue(path.exec('/'));
  test.isTrue(path.test('/1'));
  test.isTrue(path.exec('/1'));
  test.isTrue(path.test('/1/'));
  test.isTrue(path.exec('/1/'));
  test.isFalse(path.test('/1/2'));
  test.isNull(path.exec('/1/2'));


  path = new Url(paths.twoOptional);
  test.isTrue(path.test('/'));
  test.isTrue(path.exec('/'));
  test.isTrue(path.test('/1'));
  test.isTrue(path.exec('/1'));
  test.isTrue(path.test('/1/'));
  test.isTrue(path.exec('/1/'));
  test.isTrue(path.test('/1/2'));
  test.isTrue(path.exec('/1/2'));
  test.isTrue(path.test('/1/2/'));
  test.isTrue(path.exec('/1/2/'));
  test.isFalse(path.test('/1/2/3'));
  test.isNull(path.exec('/1/2/3'));

  path = new Url(paths.mixedOptional);
  test.isFalse(path.test('/'));
  test.isNull(path.exec('/'));
  test.isTrue(path.test('/1'));
  test.isTrue(path.exec('/1'));
  test.isTrue(path.test('/1/'));
  test.isTrue(path.exec('/1/'));
  test.isTrue(path.test('/1/2'));
  test.isTrue(path.exec('/1/2'));
  test.isTrue(path.test('/1/2/'));
  test.isTrue(path.exec('/1/2/'));
  test.isTrue(path.test('/1/2/3'));
  test.isTrue(path.exec('/1/2/3'));
  test.isTrue(path.test('/1/2/3/'));
  test.isTrue(path.exec('/1/2/3/'));
  test.isFalse(path.test('/1/2/3/4'));
  test.isNull(path.exec('/1/2/3/4'));

  /*
  path = new Url(paths.wildcard);
  console.log(path);
  test.isTrue(path.test('/posts/1/2'));
  test.isTrue(path.exec('/posts/1/2'));
  test.isTrue(path.test('/posts/1/2/3'));
  test.isTrue(path.exec('/posts/1/2/3'));
  test.isTrue(path.test('/posts/1/2/3/4'));
  test.isTrue(path.exec('/posts/1/2/3/4'));

  path = new Url(paths.namedWildcard);
  test.isTrue(path.test('/posts/path/to/file'), 'named wild card');
  test.isTrue(path.exec('/posts/path/to/file'), 'named wild card');
  path = new Url(paths.regex);
  test.isTrue(path.test('/commits/123..456'));
  test.isTrue(path.exec('/commits/123..456'));
  */
});

Tinytest.add('Url - query params', function (test) {
  var path = new Url(paths.explicit);
  test.isUndefined(path.params('/posts').foo);
  test.equal(path.params('/posts?foo=bar').query.foo, 'bar');
  test.equal(path.params('/posts?foo=bar%2Bbaz').query.foo, 'bar+baz');
  test.equal(path.params('/posts?foo[]=bar').query.foo, ['bar']);
  test.equal(path.params('/posts?foo%5B%5D=bar').query.foo, ['bar']);
  test.equal(path.params('/posts?foo[]=bar&foo[]=baz').query.foo, ['bar', 'baz']);
  test.equal(path.params('/posts?foo%5B%5D=bar&foo%5B%5D=baz').query.foo, ['bar', 'baz']);
  test.equal(path.params('/posts?foo=a+b').query.foo, 'a b');
  test.equal(path.params('/posts?foo=a%2Bb').query.foo, 'a+b');
  test.equal(path.params('/posts?foo=a%2520b').query.foo, 'a%20b');
});

Tinytest.add('Url - resolve', function (test) {
  var path = new Url(paths.explicit);
  test.equal(path.resolve({}), '/posts');
  test.equal(path.resolve({}, {query: {foo: 'bar'}}), '/posts?foo=bar');
  test.equal(path.resolve({}, {query: {foo: ['bar']}}), '/posts?foo[]=bar');
  test.equal(path.resolve({}, {query: {foo: ['bar', 'baz']}}), '/posts?foo[]=bar&foo[]=baz');
  // no good resolution of this one
  test.equal(path.resolve({}, {query: {foo: []}}), '/posts');
});

Tinytest.add('Url - missing params', function (test) {
  var path = new Url(paths.multi);
  test.equal(path.resolve(null), null, 'no params results in null path');

  // path.resolve should throw an error if required params are missing
  test.throws(function () {
    path.resolve(null, {throwOnMissingParams: true});
  });
});

Tinytest.add('Url - fromQueryString splits on first = only', function (test) {
  var q = Url.fromQueryString('token=abc==&plain=1');
  test.equal(q.token, 'abc==', 'characters after the first = belong to the value');
  test.equal(q.plain, '1');
});

Tinytest.add('Url - fromQueryString is safe against Object.prototype key names', function (test) {
  // previously ?__proto__[]=x crashed dispatch with a TypeError
  var q = Url.fromQueryString('__proto__[]=x&constructor[]=y&toString=z&a=1');
  test.equal(q.a, '1', 'ordinary keys still parse');
  test.isTrue(Object.prototype.hasOwnProperty.call(q, '__proto__'), '__proto__ becomes a plain own key');
  test.equal(q['__proto__'][0], 'x');
  test.equal(q['constructor'][0], 'y');
  test.equal(q['toString'], 'z');
  test.isUndefined(Object.prototype['__proto__something'], 'Object.prototype untouched');
  test.equal(Object.getPrototypeOf(q), Object.prototype, 'result prototype not replaced');
  test.isFalse(Object.prototype.hasOwnProperty.call(Object.prototype, 'x'), 'no prototype pollution');
});

Tinytest.add('Url - plus is a space in query strings but literal in paths', function (test) {
  test.equal(Url.fromQueryString('q=a+b').q, 'a b', 'form encoding: + is a space in query values');

  var url = new Url('/search/:term');
  test.equal(url.params('/search/c%2B%2B').term, 'c++', 'encoded + in path decodes to +');
  test.equal(url.params('/search/a+b').term, 'a+b', 'literal + in a path segment is not a space');
});

Tinytest.add('Url - fromQueryString skips keys that fail to decode', function (test) {
  var q = Url.fromQueryString('?%ZZ=1&ok=2');
  test.isFalse(Object.prototype.hasOwnProperty.call(q, 'undefined'),
    "an undecodable key must not become a property named 'undefined'");
  test.equal(q.ok, '2', 'well-formed pairs still parse');
});

Tinytest.add('Url - params always provides query and hash', function (test) {
  var path = new Url('/items/:id');
  var origWarn = console.warn;
  console.warn = function () {};
  try {
    // one malformed escape used to drop both query and hash
    var p = path.params('/items/1?bad=%ZZ&ok=2#frag');
    test.equal(p.id, '1');
    test.equal(p.query.ok, '2', 'valid pairs survive a malformed neighbour');
    test.equal(p.hash, 'frag');

    p = path.params('/items/%E0%A4%A?x=1#f');
    test.isUndefined(p.id, 'the undecodable segment itself is undefined');
    test.equal(p.query, {x: '1'}, 'query still parsed');
    test.equal(p.hash, 'f', 'hash still parsed');
  } finally {
    console.warn = origWarn;
  }

  test.equal(path.params('/items/1').query, {}, 'query defaults to an empty object');
  test.isNull(path.params('/items/1').hash, 'hash defaults to null');
  test.isNull(path.params('/items/1#').hash, 'an empty fragment is null');
  test.equal(path.params('/items/1?q=a?b').query.q, 'a?b', 'a ? inside a value is not a delimiter');
  test.equal(path.params('/items/1#frag?x=1').hash, 'frag?x=1', 'a ? inside the fragment belongs to the fragment');
  test.equal(path.params('/items/1#frag?x=1').query, {}, 'and is not read as a query string');
});

Tinytest.add('Url - toQueryString: undefined is a bare key, null is omitted', function (test) {
  // used to serialise the strings "undefined" and "null" (upstream #1277)
  test.equal(Url.toQueryString({a: undefined, b: null, c: 1, d: ''}), '?a&c=1&d=');
  test.equal(Url.toQueryString({a: [undefined, 'x', null]}), '?a[]=x');
  test.equal(Url.toQueryString({a: null}), '');

  // a parsed query string round-trips, bare flags included
  test.equal(Url.toQueryString(Url.fromQueryString('?flag&a=1')), '?flag&a=1');
  test.isUndefined(Url.fromQueryString(Url.toQueryString({flag: undefined})).flag);

  var path = new Url('/posts');
  test.equal(path.resolve({}, {query: {foo: undefined, bar: 1}}), '/posts?foo&bar=1');
  test.equal(path.resolve({}, {query: {foo: null, bar: 1}}), '/posts?bar=1');
});

Tinytest.add('Url - bare * is a catch-all that matches and resolves', function (test) {
  var path = new Url('/files/*');
  test.isTrue(path.test('/files/a/b/c'), 'matches nested paths');
  test.isFalse(path.test('/files/'), 'needs something to capture');
  test.isFalse(path.test('/other'));
  test.equal(path.params('/files/a/b?x=1')[0], 'a/b', 'captured positionally');
  test.equal(path.resolve(['a/b']), '/files/a/b', 'resolved positionally, slashes kept');

  var two = new Url('/f/*/x/*');
  test.equal(two.resolve(['a', 'b/c']), '/f/a/x/b/c');
  test.equal(Array.prototype.slice.call(two.params('/f/a/x/b/c')), ['a', 'b/c']);

  var literal = new Url('/a\\*b');
  test.isTrue(literal.test('/a*b'), 'an escaped star is a literal');
  test.isFalse(literal.test('/axb'));
  test.equal(literal.resolve({}), '/a*b');
});

Tinytest.add('Url - resolve handles every pattern the matcher accepts', function (test) {
  // repeat params
  var star = new Url('/files/:path*');
  test.equal(star.resolve({path: 'a/b'}), '/files/a/b', ':name* from a string');
  test.equal(star.resolve({path: ['a', 'b c']}), '/files/a/b%20c', ':name* from a list');
  test.equal(star.resolve({}), '/files', ':name* omitted');
  test.equal(star.params('/files/a/b/c').path, 'a/b/c');

  var plus = new Url('/files/:path+');
  test.equal(plus.resolve({path: 'a/b'}), '/files/a/b', ':name+ no longer leaves a literal +');
  test.isNull(plus.resolve({}), ':name+ is required');

  // unnamed and named catch-all captures
  test.equal(new Url('/files/(.*)').resolve(['a/b']), '/files/a/b');
  test.equal(new Url('/files/:path(.*)').resolve({path: 'a/b'}), '/files/a/b');

  // a single-segment param encodes a slash so the value round-trips
  var single = new Url('/p/:id');
  test.equal(single.resolve({id: 'a/b'}), '/p/a%2Fb');
  test.equal(single.params(single.resolve({id: 'a/b'})).id, 'a/b');
  test.equal(new Url('/p/:id(\\d+)').resolve({id: 12}), '/p/12');

  // an omitted optional param takes its prefix with it
  var format = new Url('/file.:ext?');
  test.equal(format.resolve({}), '/file');
  test.equal(format.resolve({ext: 'json'}), '/file.json');
  test.isTrue(format.test('/file'));
  test.equal(new Url('/p/:a/:b?/:c?').resolve({a: '1'}), '/p/1');
  test.equal(new Url('/p/:a/:b?').resolve({a: '1'}, {query: {q: '1'}}), '/p/1?q=1', 'no stray slash before the query');

  // trailing slash policy follows the matcher
  test.equal(new Url('/posts/').resolve({}), '/posts');
  test.equal(new Url('/posts/', {strict: true}).resolve({}), '/posts/');
  test.equal(new Url('/').resolve({}), '/');
});

Tinytest.add('Url - resolve leaves the query string and hash untouched', function (test) {
  var path = new Url('/posts');
  // slash normalisation used to run after these were appended
  test.equal(path.resolve({}, {query: 'u=https://e.com/a//b'}), '/posts?u=https://e.com/a//b');
  test.equal(path.resolve({}, {hash: 'a//b/'}), '/posts#a//b/');
  test.equal(path.resolve({}, {hash: '#frag'}), '/posts#frag');
  test.equal(path.resolve({}, {hash: 'a b'}), '/posts#a%20b');
});

Tinytest.add('Url - resolve keeps slashes only where the pattern can match them', function (test) {
  // a custom capture that accepts the value with its slashes
  var custom = new Url('/p/:id(a/b)');
  test.equal(custom.resolve({id: 'a/b'}), '/p/a/b');
  test.isTrue(custom.test(custom.resolve({id: 'a/b'})), 'round-trips');
  test.equal(new Url('/p/:id([a-z]+/[a-z]+)').resolve({id: 'x/y'}), '/p/x/y');
  // a plain param cannot match a slash, so it is encoded
  test.equal(new Url('/p/:id').resolve({id: 'a/b'}), '/p/a%2Fb');

  // lists are segments only for repeat params; elsewhere they stringify as before
  test.equal(new Url('/p/:id').resolve({id: ['a', 'b']}), '/p/a%2Cb');
  test.equal(new Url('/files/:path+').resolve({path: ['a', 'b']}), '/files/a/b');
  test.isNull(new Url('/files/:path+').resolve({path: []}), 'an empty list does not satisfy a required repeat');
  test.equal(new Url('/files/:path*').resolve({path: []}), '/files');
  test.isNull(new Url('/p/:id').resolve({id: null}), 'null is a missing value');
});

Tinytest.add('Url - backslash escapes in a pattern reach the regexp as before', function (test) {
  // an escaped special is a literal; an escaped letter keeps its regexp meaning
  var digit = new Url('/a\\d');
  test.isTrue(digit.test('/a1'));
  test.isFalse(digit.test('/ad'));
  var star = new Url('/a\\*b');
  test.isTrue(star.test('/a*b'));
  test.isFalse(star.test('/axb'));
  test.equal(star.resolve({}), '/a*b');
  // the default capture excludes a backslash as well as a slash
  var plain = new Url('/p/:id');
  test.isFalse(plain.test('/p/a\\b'));
  test.isTrue(plain.test('/p/a%5Cb'));
});

Tinytest.add('Url - root url path prefix helpers', function (test) {
  var config = globalThis.__meteor_runtime_config__;
  var hadConfig = !!config;
  var previous = hadConfig ? config.ROOT_URL_PATH_PREFIX : undefined;

  try {
    // an override is normalised: leading slash, no trailing slash
    Url.setRootUrlPathPrefix('beta/');
    test.equal(Url.rootUrlPathPrefix(), '/beta');
    Url.setRootUrlPathPrefix('/');
    test.equal(Url.rootUrlPathPrefix(), '', 'a bare slash is no prefix');
    Url.setRootUrlPathPrefix('');
    test.equal(Url.rootUrlPathPrefix(), '');

    Url.setRootUrlPathPrefix('/beta');
    test.equal(Url.withRootUrlPathPrefix('/hello?x=1#f'), '/beta/hello?x=1#f');
    test.equal(Url.withRootUrlPathPrefix('/'), '/beta/');
    test.equal(Url.withRootUrlPathPrefix('hello'), 'hello', 'a route name is left alone');
    test.equal(Url.withRootUrlPathPrefix('http://h/x'), 'http://h/x', 'an absolute url is left alone');

    test.equal(Url.withoutRootUrlPathPrefix('http://h:3000/beta/hello?x=1#f'), 'http://h:3000/hello?x=1#f');
    test.equal(Url.withoutRootUrlPathPrefix('/beta/hello'), '/hello');
    test.equal(Url.withoutRootUrlPathPrefix('/beta'), '/', 'the prefix alone is the application root');
    test.equal(Url.withoutRootUrlPathPrefix('/beta/'), '/');
    test.equal(Url.withoutRootUrlPathPrefix('/beta?x=1'), '/?x=1');
    test.equal(Url.withoutRootUrlPathPrefix('/beta#!'), '/#!');
    test.equal(Url.withoutRootUrlPathPrefix('/betamax/hello'), '/betamax/hello', 'a segment merely starting with the prefix is not it');
    test.equal(Url.withoutRootUrlPathPrefix('/hello'), '/hello', 'a url outside the prefix is left alone');

    test.equal(Url.withRootUrlPathPrefix('/beta/hello'), '/beta/hello', 'a path already below the prefix is left alone');
    test.equal(Url.withRootUrlPathPrefix('/beta'), '/beta');
    test.equal(Url.withRootUrlPathPrefix('/betamax'), '/beta/betamax');
    test.equal(Url.withRootUrlPathPrefix('//other.example/x'), '//other.example/x', 'a protocol-relative url is not an application path');

    test.isTrue(Url.isWithinRootUrlPathPrefix('/beta/hello'));
    test.isTrue(Url.isWithinRootUrlPathPrefix('/beta'));
    test.isTrue(Url.isWithinRootUrlPathPrefix('http://h/beta/?x'));
    test.isFalse(Url.isWithinRootUrlPathPrefix('/hello'));
    test.isFalse(Url.isWithinRootUrlPathPrefix('/betamax/hello'));

    // without an override the prefix comes from Meteor's runtime config
    Url.setRootUrlPathPrefix(null);
    if (!hadConfig)
      globalThis.__meteor_runtime_config__ = config = {};
    config.ROOT_URL_PATH_PREFIX = '/rc';
    test.equal(Url.rootUrlPathPrefix(), '/rc');
    delete config.ROOT_URL_PATH_PREFIX;
    test.equal(Url.rootUrlPathPrefix(), '');
    test.equal(Url.withRootUrlPathPrefix('/hello'), '/hello', 'no prefix, no change');
    test.equal(Url.withoutRootUrlPathPrefix('/beta/hello'), '/beta/hello');
    test.isTrue(Url.isWithinRootUrlPathPrefix('/anything'), 'everything is within an empty prefix');
  } finally {
    Url.setRootUrlPathPrefix(null);
    if (!hadConfig)
      delete globalThis.__meteor_runtime_config__;
    else if (typeof previous === 'undefined')
      delete config.ROOT_URL_PATH_PREFIX;
    else
      config.ROOT_URL_PATH_PREFIX = previous;
  }
});
