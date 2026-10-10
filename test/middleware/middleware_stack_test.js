Tinytest.add('MiddlewareStack - handler names and paths', function (test) {
  let handler;

  // path is a name
  handler = new Handler('home', {});
  test.equal(handler.name, 'home', 'name is "home"');
  test.equal(handler.path, '/home', 'path is "/home"');

  // path is an option
  handler = new Handler('home', {path: '/foo'});
  test.equal(handler.name, 'home', 'name is "home"');
  test.equal(handler.path, '/foo', 'path is "/foo"');

  handler = new Handler('/home', {path: '/bar'});
  test.equal(handler.path, '/bar', 'path is "/bar"');

  handler = new Handler('/home', {path: '/bar', name: 'foo'});
  test.equal(handler.path, '/bar', 'path is "/bar"');
  test.equal(handler.name, 'foo', 'name is "foo"');
});

Tinytest.add('MiddlewareStack - create and find by name', function (test) {
  // basically just test that a handler gets created and keyed by name if thee's
  // a name. Also test duplicate named handlers throws an error.

  const stack = new Iron.MiddlewareStack;
  stack._create('/items', function () {}, {name: 'items'});
  test.isTrue(stack.findByName('items'));

  test.throws(function () {
    // same name
    stack._create('/items', function () {}, {name: 'items'});
  });
});

Tinytest.add('MiddlewareStack - duplicate implicit names', function (test) {
  const stack = new Iron.MiddlewareStack;

  // Two functions with the same implicit name should not collide.
  function sameName() {}
  function sameName2() {}
  Object.defineProperty(sameName2, 'name', {value: sameName.name});

  stack.append(sameName);
  stack.append(sameName2);
  test.equal(stack.length, 2, 'implicit duplicate names should not throw');

  // Explicitly named handlers should still collide.
  stack.push('/one', function () {}, {name: 'explicit'});
  test.throws(function () {
    stack.push('/two', function () {}, {name: 'explicit'});
  });
});

Tinytest.add('MiddlewareStack - insertBefore/insertAfter target first implicit match', function (test) {
  const stack = new Iron.MiddlewareStack;

  function dup() {}
  function dup2() {}
  Object.defineProperty(dup2, 'name', {value: dup.name});

  function before() {}
  function after() {}

  stack.push(dup);
  stack.push(dup2);

  stack.insertBefore('dup', before);
  test.equal(stack._stack[0].handle, before, 'insertBefore should target first implicit match');

  stack.insertAfter('dup', after);
  test.equal(stack._stack[2].handle, after, 'insertAfter should target first implicit match');
});

Tinytest.add('MiddlewareStack - push', function (test) {
  const stack = new Iron.MiddlewareStack;
  const fns = [function () {}, function () {}];
  stack.push(fns[0]);
  test.equal(stack._stack[0].handle, fns[0]);
  stack.push(fns[1]);
  test.equal(stack._stack[1].handle, fns[1]);
});

Tinytest.add('MiddlewareStack - insertAt', function (test) {
  const stack = new Iron.MiddlewareStack;
  const fns = [function () {}, function () {}, function () {}];
  stack.push(fns[0]);
  stack.push(fns[2]);

  stack.insertAt(1, fns[1]);
  test.equal(stack._stack[1].handle, fns[1]);
});

Tinytest.add('MiddlewareStack - insertBefore', function (test) {
  const stack = new Iron.MiddlewareStack;
  const fns = [function one() {}, function two() {}, function three() {}];
  stack.push(fns[0]);
  stack.push(fns[2]);
  stack.insertBefore('three', fns[1]);
  test.equal(stack._stack[1].handle, fns[1]);
});

Tinytest.add('MiddlewareStack - insertAfter ', function (test) {
  const stack = new Iron.MiddlewareStack;
  const fns = [function one() {}, function two() {}, function three() {}];
  stack.push(fns[0]);
  stack.push(fns[2]);
  stack.insertAfter('one', fns[1]);
  test.equal(stack._stack[1].handle, fns[1]);
});

Tinytest.add('MiddlewareStack - dispatch iteration with this.next', function (test) {
  const stack = new Iron.MiddlewareStack;
  const calls = [];

  if (Meteor.isClient) {
    stack.push(function m1 () {
      calls.push('m1');
      this.next();
    });

    stack.push(function m2 () {
      calls.push('m2');
      // no call to next
    });

    stack.push(function m3 () {
      calls.push('m3');
    });

    stack.dispatch('/', {});
    test.equal(calls.length, 2, "call length is two");
    test.equal(calls[0], 'm1', "m1 called");
    test.equal(calls[1], 'm2', "m2 called");
  }

  if (Meteor.isServer) {
    stack.push(function m1 () {
      calls.push('m1');
      this.next();
    }, {where: 'server'});

    stack.push(function m2 () {
      calls.push('m2');
      // no call to next
    }, {where: 'server'});

    stack.push(function m3 () {
      calls.push('m3');
    }, {where: 'server'});

    stack.dispatch('/', {});
    test.equal(calls.length, 2, "call length is two");
    test.equal(calls[0], 'm1', "m1 called");
    test.equal(calls[1], 'm2', "m2 called");
  }
});

Tinytest.add('MiddlewareStack - dispatch callback', function (test) {
  const stack = new Iron.MiddlewareStack;
  const calls = [];

  if (Meteor.isClient) {
    stack.push(function m1 () {
      calls.push('m1');
      this.next();
    });

    stack.dispatch('/', {}, function () {
      calls.push('done');
    });

    test.equal(calls.length, 2, "call length is two");
    test.equal(calls[0], 'm1', "m1 called");
    test.equal(calls[1], 'done', "done called");
  }

  if (Meteor.isServer) {
    stack.push(function m1 () {
      calls.push('m1');
      this.next();
    }, {where: 'server'});

    stack.dispatch('/', {}, function () {
      calls.push('done');
    });

    test.equal(calls.length, 2, "call length is two");
    test.equal(calls[0], 'm1', "m1 called");
    test.equal(calls[1], 'done', "done called");
  }
});

// Fibers test only runs on Meteor < 3.0 where Fibers are available
if (Meteor.isServer && !Meteor.isFibersDisabled) {
  const Fiber = Npm.require('fibers');
  Tinytest.addAsync('MiddlewareStack - async next maintains fibers', function (test, done) {
    const envVar = new Meteor.EnvironmentVariable;

    envVar.withValue(true, function () {
      const stack = new Iron.MiddlewareStack;

      test.isTrue(envVar.getOrNullIfOutsideFiber());
      stack.push(function(req, res, next) {
        // break out of the current fiber
        setTimeout(function() {
          next();
        }, 0);
      }, {where: 'server'});

      stack.push(function(req, res, next) {
        test.isTrue(envVar.getOrNullIfOutsideFiber());
        this.next();
      }, {where: 'server'});

      stack.dispatch('/', {}, function () {
        test.isTrue(envVar.getOrNullIfOutsideFiber());
        done();
      });
    });
  });
}

Tinytest.addAsync('MiddlewareStack - async handler rejection reaches done', function (test, onComplete) {
  var stack = new Iron.MiddlewareStack;

  stack.push(async function (req, res, next) {
    throw new Error('async boom');
  }, {where: Meteor.isServer ? 'server' : 'client'});

  stack.dispatch('/', {}, function (err) {
    test.isTrue(!!err, 'done should receive the rejection');
    test.equal(err && err.message, 'async boom');
    onComplete();
  });
});

Tinytest.addAsync('MiddlewareStack - this.next() works after an await', function (test, onComplete) {
  var stack = new Iron.MiddlewareStack;
  var sequence = [];

  var where = {where: Meteor.isServer ? 'server' : 'client'};

  stack.push(async function (req, res, next) {
    await new Promise(function (resolve) { setTimeout(resolve, 10); });
    sequence.push('async first');
    this.next();
  }, where);

  stack.push(function (req, res, next) {
    sequence.push('sync second');
    this.next();
  }, where);

  stack.dispatch('/', {}, function (err) {
    test.isUndefined(err, 'no error expected');
    test.equal(sequence, ['async first', 'sync second'], 'handlers ran in order across the await');
    onComplete();
  });
});

Tinytest.addAsync('MiddlewareStack - async rejection is caught by error middleware', function (test, onComplete) {
  var stack = new Iron.MiddlewareStack;
  var caught = null;

  var whereOpt = {where: Meteor.isServer ? 'server' : 'client'};

  stack.push(async function (req, res, next) {
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    throw new Error('rejected later');
  }, whereOpt);

  stack.push(function (err, req, res, next) {
    caught = err;
    next();
  }, whereOpt);

  stack.dispatch('/', {}, function (err) {
    test.equal(caught && caught.message, 'rejected later', 'error middleware saw the rejection');
    test.isUndefined(err, 'error middleware consumed the error');
    onComplete();
  });
});

Tinytest.add('MiddlewareStack - handler names colliding with Array members', function (test) {
  var stack = new Iron.MiddlewareStack;

  stack.push('/x', function () {}, {name: 'push'});
  stack.push('/y', function () {}, {name: 'map'});
  stack.push('/z', function () {}, {name: 'zed'});

  test.equal(stack.length, 3, 'stack still accepts handlers after method-name collisions');
  test.isTrue(!!stack.findByName('push'), 'handler named push is addressable');
  test.isUndefined(stack.findByName('slice'), 'findByName no longer resolves Array.prototype members');
  test.throws(function () {
    stack.insertBefore('slice', '/q', function () {});
  }, /Couldn't find a handler/);
});

Tinytest.add('MiddlewareStack - explicit duplicate middleware names are rejected', function (test) {
  var stack = new Iron.MiddlewareStack;

  stack.push(function () {}, {name: 'auth'});
  test.throws(function () {
    stack.push(function () {}, {name: 'auth'});
  }, /already exists/);
});

Tinytest.addAsync('MiddlewareStack - late rejection after next() does not complete the stack twice', function (test, onComplete) {
  var stack = new Iron.MiddlewareStack;
  var whereEnv = {where: Meteor.isServer ? 'server' : 'client'};
  var doneCalls = [];

  stack.push(async function (req, res, next) {
    this.next();
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    throw new Error('late rejection');
  }, whereEnv);

  stack.push(function (req, res, next) {
    this.next();
  }, whereEnv);

  stack.dispatch('/', {}, function (err) {
    doneCalls.push(err);
  });

  setTimeout(function () {
    test.equal(doneCalls.length, 1, 'done must be called exactly once');
    test.isUndefined(doneCalls[0], 'the successful completion wins; the late rejection is logged');
    onComplete();
  }, 40);
});

Tinytest.addAsync('MiddlewareStack - a throwing drain callback is logged and does not stop the others', function (test, onComplete) {
  // _onAsyncDrain callbacks (the route controller queues its after hooks
  // there) run inside the fulfilment branch of the async handler's promise
  // chain. A throw used to become an unhandled rejection, which exits the
  // process on modern Node and silently dropped every later callback.
  var stack = new Iron.MiddlewareStack;
  var whereEnv = {where: Meteor.isServer ? 'server' : 'client'};
  var ran = [];
  var logged = [];
  var origError = console.error;
  var unhandled = [];
  var onUnhandled = function (reason) { unhandled.push(reason); };

  console.error = function () { logged.push(Array.prototype.slice.call(arguments)); };
  if (Meteor.isServer)
    process.on('unhandledRejection', onUnhandled);

  stack.push(async function (req, res, next) {
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    this.next();
  }, whereEnv);

  var context = {
    _onAsyncDrain: [
      function () { ran.push('first'); throw new Error('after hook failed'); },
      function () { ran.push('second'); }
    ]
  };

  stack.dispatch('/', context, function () { ran.push('done'); });

  setTimeout(function () {
    console.error = origError;
    if (Meteor.isServer)
      process.removeListener('unhandledRejection', onUnhandled);

    test.equal(ran, ['done', 'first', 'second'], 'every drain callback runs, after done');
    test.equal(logged.length, 1, 'the failure is logged once');
    test.isTrue(/after hook failed/.test(String(logged[0] && logged[0][1])), 'the logged error is the hook error');
    test.equal(unhandled.length, 0, 'no unhandled rejection reaches the process');
    onComplete();
  }, 40);
});
