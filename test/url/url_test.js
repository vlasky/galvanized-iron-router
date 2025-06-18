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
