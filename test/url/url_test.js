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
