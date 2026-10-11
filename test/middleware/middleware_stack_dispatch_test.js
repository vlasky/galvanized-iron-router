Tinytest.add('MiddlewareStack - dispatch', function (test) {
  const stack = new Iron.MiddlewareStack;
  const calls = {};
  const call = function (name) {
    calls[name] = calls[name] || 0;
    calls[name]++;
  };

  // client middleware
  stack.push(function m1 (req, res, next) {
    call('m1');
    next();
  });

  stack.push(function m2 (req, res, next) {
    call('m2');
    this.next();
  });

  // client handlers
  let params;
  stack.push('/items/:id', function item (req, res, next) {
    call('item');
    params = this.params;
    next();
  });

  // same path is okay as long as name is different
  stack.push('/items/:id', function itemTwo (req, res, next) {
    call('item2');
  });

  // server handler
  stack.push('/server', function server (req, res, next) {
    call('server');
  }, { where: 'server' });

  const thisArg = {};

  if (Meteor.isClient) {
    stack.dispatch('/', {});
    test.equal(calls.m1, 1, 'm1 not called');
    test.equal(calls.m2, 1, 'm2 not called');
    test.isFalse(calls.item);
    test.isFalse(calls.item2);
    test.isFalse(calls.server);

    stack.dispatch('/items/1', thisArg);
    test.equal(calls.m1, 2, 'm1 not called');
    test.equal(calls.m2, 2, 'm2 not called');
    test.equal(calls.item, 1, 'item not called');
    test.equal(calls.item2, 1, 'item2 not called');
    test.isFalse(calls.server);

    const params = thisArg.params;
    test.equal(params.id, "1");

    stack.onServerDispatch(function () {
      call('serverDispatch');
    });

    stack.dispatch('/server', {});
    test.equal(calls.serverDispatch, 1);
  }

  if (Meteor.isServer) {
    stack.dispatch('/server', {});
    test.isFalse(calls.m1);
    test.isFalse(calls.m2);
    test.equal(calls.server, 1);
  }
});

Tinytest.add('MiddlewareStack - dispatch error handling', function (test) {
  if (Meteor.isClient) {
    const stack = new Iron.MiddlewareStack;
    const calls = [];
    stack.push(function (req, res, next) {
      calls.push(1);
      throw new Error('test');
    });

    stack.push(function (req, res, next) {
      calls.push(2);
      next();
    });

    stack.dispatch('/', {
      next: function (err) {
        calls.push(3);
        test.equal(err.message, 'test');
      }
    });

    test.equal(calls.length, 2);

    // first fn throws an error
    test.equal(calls[0], 1);

    // rest of middleware skipped
    test.equal(calls[1], 3);
  }
});

Tinytest.add('MiddlewareStack - mounting paths', function (test) {
  const stack = new Iron.MiddlewareStack;
  const calls = [];

  if (Meteor.isClient) {
    // add a mounted handler at mountpath /foo
    stack.push('/foo', function (req, res, next) {
      // Clone only the properties we test (avoiding EJSON issues with functions)
      calls.push({
        args: [{url: req.url, originalUrl: req.originalUrl}],
        thisArg: {url: this.url, originalUrl: this.originalUrl}
      });
      next();
    }, {mount: true});

    // add a regular handler at /foo/bar/baz
    stack.push('/foo/bar/baz', function (req, res, next) {
      calls.push({
        args: [{url: req.url, originalUrl: req.originalUrl}],
        thisArg: {url: this.url, originalUrl: this.originalUrl}
      });
    });

    stack.dispatch('/foo/bar/baz', {});

    // make sure it got called
    test.equal(calls.length, 2);

    // this.url
    test.equal(calls[0].thisArg.url, '/bar/baz', 'url wrong on controller');
    test.equal(calls[0].thisArg.originalUrl, '/foo/bar/baz', 'originalUrl wrong on controller');

    // fn (req, res, next)
    //  req.url
    test.equal(calls[0].args[0].url, '/bar/baz', 'url wrong on req');
    test.equal(calls[0].args[0].originalUrl, '/foo/bar/baz', 'originalUrl wrong on req');

    // now make sure the url is set back to the originalUrl for non mounted
    // handlers.
    test.equal(calls[1].thisArg.url, '/foo/bar/baz');
    test.equal(calls[1].thisArg.originalUrl, '/foo/bar/baz');

    // fn (req, res, next)
    //  req.url
    test.equal(calls[1].args[0].url, '/foo/bar/baz');
    test.equal(calls[1].args[0].originalUrl, '/foo/bar/baz');
  }

  if (Meteor.isServer) {
    stack.push('/foo', function (req, res, next) {
      // Clone only the properties we test (avoiding EJSON issues with functions)
      calls.push({
        args: [{url: req.url, originalUrl: req.originalUrl}],
        thisArg: {url: this.url, originalUrl: this.originalUrl}
      });
      next();
    }, {mount: true, where: 'server'});

    // add a regular handler at /foo/bar/baz
    stack.push('/foo/bar/baz', function (req, res, next) {
      calls.push({
        args: [{url: req.url, originalUrl: req.originalUrl}],
        thisArg: {url: this.url, originalUrl: this.originalUrl}
      });
    }, {where: 'server'});

    stack.dispatch('/foo/bar/baz', {});

    // make sure it got called
    test.equal(calls.length, 2);

    // this.url
    test.equal(calls[0].thisArg.url, '/bar/baz');
    test.equal(calls[0].thisArg.originalUrl, '/foo/bar/baz');

    // fn (req, res, next)
    //  req.url
    test.equal(calls[0].args[0].url, '/bar/baz');
    test.equal(calls[0].args[0].originalUrl, '/foo/bar/baz');

    // now make sure the url is set back to the originalUrl for non mounted
    // handlers.
    test.equal(calls[1].thisArg.url, '/foo/bar/baz');
    test.equal(calls[1].thisArg.originalUrl, '/foo/bar/baz');

    // fn (req, res, next)
    //  req.url
    test.equal(calls[1].args[0].url, '/foo/bar/baz');
    test.equal(calls[1].args[0].originalUrl, '/foo/bar/baz');
  }
});

Tinytest.add('MiddlewareStack - dispatch preserves query params (GH #6)', function (test) {
  const stack = new Iron.MiddlewareStack;
  const where = Meteor.isServer ? 'server' : 'client';

  stack.push('/items/:id', function item (req, res, next) {
    if (next) next();
  }, { where: where });

  const thisArg = {};

  // The dispatched url carries a query string and a hash fragment. Even though
  // Url.normalize strips these for path matching, the parsed params must still
  // expose them. Regression test for the 2.1.x bug where the query object was
  // clobbered with {} because handler.params() ran against the normalized url.
  stack.dispatch('/items/42?token=abc&list[]=1&list[]=2#frag', thisArg);

  test.equal(thisArg.params.id, '42', 'path param not parsed');
  test.equal(thisArg.params.query.token, 'abc', 'query param token missing');
  test.equal(thisArg.params.query.list, ['1', '2'], 'array query param missing');
  test.equal(thisArg.params.hash, 'frag', 'hash fragment missing');
});

Tinytest.add('MiddlewareStack - append with options', function (test) {
  const fn1 = function () {};
  const fn2 = function () {};
  const stack = new Iron.MiddlewareStack;
  stack.append(fn1, fn2, {where: 'server'});

  test.equal(stack._stack[0].where, 'server');
  test.equal(stack._stack[1].where, 'server');
});

//TODO concat
//TODO append

Tinytest.add('MiddlewareStack - a pass-through middleware does not mark the request handled', function (test) {
  const where = Meteor.isClient ? 'client' : 'server';
  const stack = new Iron.MiddlewareStack;
  const dispatch = function (url) {
    return stack.dispatch(url, {}, function () {});
  };

  // pathless middleware (Router.use(fn)) that passes every request on
  stack.push(function logger (req, res, next) {
    next();
  }, {where: where});

  let context = dispatch('/unknown');
  test.isFalse(context.isHandled(), 'a middleware that called next() has not handled the request');
  test.isFalse(context.willBeHandledOnClient());
  test.isFalse(context.willBeHandledOnServer());

  // a mounted middleware counts as a handler for its environment (that is
  // what sends the client to the server for its urls) but passing the
  // request on does not mark it handled either
  stack.push('/admin', function admin (req, res, next) {
    next();
  }, {where: where, mount: true});

  context = dispatch('/admin/users');
  test.isFalse(context.isHandled(), 'a mounted middleware that called next() has not handled the request');
  test.isTrue(context['willBeHandledOn' + (Meteor.isClient ? 'Client' : 'Server')]());

  // a route (not mounted) marks the request handled even when it passes it on
  stack.push('/items/:id', function item (req, res, next) {
    next();
  }, {where: where});

  context = dispatch('/items/1');
  test.isTrue(context.isHandled(), 'a route marks the request handled');

  // a middleware that ends the chain synchronously does not mark it either:
  // the stack cannot tell it from one that will call next() later from a
  // callback, and handled means a route ran
  stack.push(function terminal (req, res, next) {
    // does not call next
  }, {where: where});

  context = dispatch('/unknown');
  test.isFalse(context.isHandled(), 'a middleware that ended the chain does not mark the request handled');
});

Tinytest.addAsync('MiddlewareStack - deferred and async pass-through middleware do not mark the request handled', function (test, onComplete) {
  const where = Meteor.isClient ? 'client' : 'server';
  const stack = new Iron.MiddlewareStack;

  // connect middleware commonly calls next() from a later callback, pathless
  // or mounted
  stack.push(function deferred (req, res, next) {
    setTimeout(next, 0);
  }, {where: where});
  stack.push('/', function mountedDeferred (req, res, next) {
    setTimeout(next, 0);
  }, {where: where, mount: true});

  // an error handler is skipped when there is no error and must not count
  stack.push(function errors (err, req, res, next) {
    next(err);
  }, {where: where});

  stack.push(function asyncLogger (req, res, next) {
    return Promise.resolve().then(function () { next(); });
  }, {where: where});

  // read it where the router does: in the completion callback
  stack.dispatch('/unknown', {}, function () {
    test.isFalse(this.isHandled(), 'middleware that passed the request on, at once or later, has not handled it');
    // the mounted one still counts as a handler for its environment
    test.isTrue(this['willBeHandledOn' + (Meteor.isClient ? 'Client' : 'Server')]());
    onComplete();
  });
});
