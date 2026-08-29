Tinytest.add('Router - createController', function (test) {
  test.ok();
});

// XXX: this test fails on the server because of the check that a single route
//   must be defined or the server short-circuits and displays an error.
Meteor.isClient && Tinytest.add('Router - dispatch - current', function (test) {
  var calls = [];
  var call;
  var origDispatch = Iron.RouteController.prototype.dispatch;

  Iron.RouteController.prototype.dispatch = function (stack, url, done) {
    calls.push({
      thisArg: this,
      url: url,
      stack: stack
    });
  };

  try {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var req = {url: '/test'};
    var res = {
      setHeader: function () {},
      end: function () {}
    };
    var next = function () {};
    var current;

    if (Meteor.isClient) {
      Tracker.autorun(function (c) {
        current = router.current();
      });

      router(req, res, next);

      test.equal(calls.length, 1, 'RouteController dispatch method called');
      call = calls[0];
      test.equal(call.url, '/test', 'dispatch url is set');
      test.instanceOf(call.thisArg, Iron.RouteController, 'thisArg is a RouteController');
      test.instanceOf(call.stack, Iron.MiddlewareStack, 'stack is a MiddlewareStack');

      test.isNull(current, 'current is null until a flush');
      Tracker.flush();
      test.instanceOf(current, Iron.RouteController, 'current is instance of Iron.RouteController');
      test.equal(current.request, req, 'request is set');
      test.equal(current.response, res, 'response is set');

      var oldCurrent = current;

      var stopped = false;
      oldCurrent.stop = function () { stopped = true; };

      router(req, res, next);
      test.isTrue(stopped, 'previous controller stopped');
      Tracker.flush();
      test.isTrue(oldCurrent !== current, 'current controller is not the old controller');
    }

    // XXX FIXME
    if (Meteor.isServer) {
      router(req, res, next);

      if (calls.length < 1) {
        test.fail("dispatch call was not made");
      } else {
        var call = calls[0];
        var current = calls[0].thisArg;
        test.instanceOf(current, Iron.RouteController, 'thisArg is a RouteController');
        test.equal(current.request, req, 'request is set');
        test.equal(current.response, res, 'response is set');
        test.instanceOf(call.stack, Iron.MiddlewareStack, 'stack is a MiddlewareStack');
      }
    }
  } finally {
    Iron.RouteController.prototype.dispatch = origDispatch;
  }
});

if (Meteor.isClient) {
  Tinytest.add('Router - global hooks receive runtime args', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var captured = {};

    router.onBeforeAction(function (req, res, next) {
      captured.req = req;
      captured.res = res;
      captured.nextType = typeof next;
      captured.thisArg = this;
      next();
    });

    router.route('/hook-test', function (req, res, next) {
      next();
      // This test isn't about rendering; stop explicitly to avoid warnings.
      this.stop();
    });

    var req = {url: '/hook-test'};
    var res = {};

    router.dispatch('/hook-test', {request: req, response: res});

    test.equal(captured.req, req, 'hook received request');
    test.equal(captured.res, res, 'hook received response');
    test.equal(captured.nextType, 'function', 'hook received next');
    test.instanceOf(captured.thisArg, Iron.RouteController, 'hook thisArg is RouteController');
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - scrollToHash uses decoded element ids and native scrolling', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var target = document.createElement('div');
    var scrollTo = window.scrollTo;
    var scrollCalls = [];

    target.id = 'hash target';
    target.getBoundingClientRect = function () {
      return {top: 125};
    };
    document.body.appendChild(target);
    window.scrollTo = function (x, y) {
      scrollCalls.push([x, y]);
    };

    try {
      router._scrollToHash('#hash%20target');
      test.equal(scrollCalls, [[window.scrollX, 125 + window.scrollY]],
        'encoded fragment resolves and preserves horizontal scroll');

      router._scrollToHash('#missing-target');
      router._scrollToHash('#%ZZ');
      test.equal(scrollCalls.length, 1, 'missing and malformed fragments are ignored');
    } finally {
      window.scrollTo = scrollTo;
      target.remove();
    }
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - dispatch - same route', function (test) {
    // if we go from one url to the next and its the same route, we don't
    // need to create a new controller instance. this tests that we keep
    // the same controller around, and that the getParams dep works
    // correctly.
    //
    // the rules are that the controller's computation should be the same
    // and the action function should rerun. how do we test helper dependency?
    // we can do that in dynamic template.

    var calls = [];
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var prevComp;
    var newComp;

    router.route('/items/:id', function () {
      calls.push({
        thisArg: this,
        id: this.params.id
      });
      // This test isn't about rendering; stop explicitly to avoid warnings.
      this.stop();
    });

    var prevController;

    prevController = router.dispatch('/items/1', {});
    prevComp = prevController._computation;
    Deps.flush();
    test.isTrue(calls[0], "action function not called");
    test.equal(calls[0].id, "1", "this.params.id is incorrect");

    var getParamsValues = [];
    Tracker.autorun(function () {
      getParamsValues.push(prevController.getParams());
    });

    test.isTrue(getParamsValues[0], 'no params from getParams()');
    test.equal(getParamsValues[0].id, "1", "id param is incorrect");

    newController = router.dispatch('/items/2', {});
    newComp = newController._computation;
    Deps.flush();
    test.isTrue(calls[1], "action function not called");
    test.equal(calls[1].id, "2", "this.params.id is incorrect");

    test.isTrue(getParamsValues[1], 'no params from getParams()');
    test.equal(getParamsValues[1].id, "2", "id param is incorrect");

    test.equal(newController, prevController, "new controller should be the same instance as the old controller");
    test.notEqual(prevComp, newComp, "new computation should have been created");
  });
}

Tinytest.add('Router - dispatch - error handling', function (test) {
  // TODO?
});

Tinytest.add('Router - dispatch - notFound and unhandled', function (test) {
  // TODO?
});

if (Meteor.isClient) {
  // See https://github.com/EventedMind/iron-router/issues/869
  // XXX this test should be fixed so that it produces the same outcome. right now it only passes on the first one
  // and it's changing the url which it should not do. maybe this means we need to mock out the location.go stuff, or
  // have an option where the url doesn't change in iron:location?
  /*
  Tinytest.add('Router - redirection maintains reactivity', function(test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
  
    var twoActionRan = 0;
    var dep = new Deps.Dependency;

    router.route('/one', function () {
      dep.depend();
      router.go('two');
    });

    router.route('/two', function () {
      dep.depend();
      twoActionRan += 1;
    });

    router.start();
    router.go('one');
    Deps.flush();
    test.equal(twoActionRan, 1, "redirected route action should have run once");
  
    dep.changed();
    Deps.flush();
    test.equal(twoActionRan, 2, "redirected route action should rerun if computation invalidated");
  });
  */
}

if (Meteor.isServer) {
  // Global fetch only exists from Node 18 (Meteor 3). The core fetch package
  // polyfills it on Meteor 2 (and re-exports the native one on Meteor 3).
  var fetch = require('meteor/fetch').fetch;

  Tinytest.add('Router - server - configureBodyParsers registers global before hooks', function (test) {
    var router = new Iron.Router({autoStart: false, autoRender: false});
    var before = router.getHooks('onBeforeAction', 'anyRoute').length;
    router.configureBodyParsers();
    var after = router.getHooks('onBeforeAction', 'anyRoute').length;
    test.equal(after - before, 2, 'json and urlencoded body parsers should be added as instance hooks');
  });

  Tinytest.add('Router - server - jquery warning fires only on Meteor 2 without client jquery', function (test) {
    var needsWarning = Iron.Router._needsJqueryWarning;
    test.isTrue(needsWarning(false, undefined), 'Meteor 2 without jquery in the client bundle warns');
    test.isFalse(needsWarning(true, undefined), 'Meteor 2 with jquery in the client bundle does not warn');
    test.isFalse(needsWarning(null, undefined), 'an unknown client bundle stays silent');
    test.isFalse(needsWarning(false, true), 'Meteor 3 never warns (Blaze version is unknowable server-side)');
    test.isFalse(needsWarning(true, true), 'Meteor 3 with jquery does not warn');
  });

  Tinytest.add('Router - server - client bundle jquery detection reads the program manifest', function (test) {
    // The test client always contains jquery (the Tinytest driver depends on
    // it), so the manifest check must report true here on every Meteor
    // version - this is exactly the case the server Package namespace gets
    // wrong, since the driver's jquery dependency is client-only.
    test.equal(Iron.Router._clientBundleHasJquery(), true,
      'jquery is present in the test client bundle');
  });

  // Route definition and start live at module scope: Tinytest re-runs test
  // bodies on every client test run, and defining the same route twice throws.
  Router.route('/test-body-parser-post', {where: 'server'}).post(function () {
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify({received: this.request.body}));
  });

  // The test bootstrap disables autoStart, so attach the global router
  // (and its body parsers) to the webapp for the end-to-end test below.
  Router.start();

  Tinytest.addAsync('Router - server - REST route receives parsed JSON body', function (test, onComplete) {
    var payload = {title: 'galvanized', count: 3};

    fetch(Meteor.absoluteUrl('test-body-parser-post'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json();
    }).then(function (data) {
      test.equal(data.received, payload, 'request.body should contain the parsed JSON payload');
      onComplete();
    }).catch(function (err) {
      test.fail('POST request failed: ' + err.message);
      onComplete();
    });
  });
}

if (Meteor.isServer) {
  Router.route('/test-async-post', {where: 'server'}).post(async function () {
    await new Promise(function (resolve) { setTimeout(resolve, 10); });
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify({ok: true, got: this.request.body}));
  });

  Router.route('/test-async-error', {where: 'server'}).get(async function () {
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    throw new Error('async route failure');
  });

  Tinytest.addAsync('Router - server - async REST action can await before responding', function (test, onComplete) {
    fetch(Meteor.absoluteUrl('test-async-post'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({n: 42})
    }).then(function (res) {
      test.equal(res.status, 200);
      return res.json();
    }).then(function (data) {
      test.isTrue(data.ok, 'async action responded after its await');
      test.equal(data.got && data.got.n, 42, 'parsed body available in async action');
      onComplete();
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
      onComplete();
    });
  });

  Tinytest.addAsync('Router - server - async REST action rejection returns a 500', function (test, onComplete) {
    fetch(Meteor.absoluteUrl('test-async-error')).then(function (res) {
      test.equal(res.status, 500, 'rejection becomes a 500 instead of a hung request');
      onComplete();
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
      onComplete();
    });
  });
}

Tinytest.add('Router - routes named after Array members do not corrupt the router', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});

  // each of these previously shadowed a method on the routes array / stack
  router.route('/push', function () {});
  router.route('/map', function () {});
  router.route('/length', function () {});
  router.route('/ordinary', function () {});

  test.equal(router.routes.length, 4, 'routes array stays intact');
  test.isTrue(!!router.findRouteByName('push'), 'route named push is addressable by name');
  test.isTrue(!!router.findRouteByName('length'), 'route named length is addressable by name');
  test.equal(typeof router.routes.push, 'function', 'Array.prototype.push not shadowed');
  test.isTrue(!!router.routes.ordinary, 'legacy Router.routes.name alias still works for safe names');
});

Tinytest.add('Router - registerController ignores inherited _name', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});

  class NamedBase extends Iron.RouteController {}
  NamedBase._name = 'NamedBase';
  class SubClass extends NamedBase {}

  router.registerControllers([NamedBase, SubClass]);
  test.equal(router.getController('NamedBase'), NamedBase, 'base registered under its own _name');
  test.equal(router.getController('SubClass'), SubClass, 'subclass must not register under the inherited _name');
});

if (Meteor.isClient) {
  Tinytest.addAsync('Router - client - onAfterAction waits for an async action', function (test, onComplete) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var order = [];

    router.route('/async-after', {
      onAfterAction: function () {
        order.push('after');
      },
      action: async function () {
        await new Promise(function (resolve) { setTimeout(resolve, 10); });
        order.push('action');
        this.stop();
      }
    });

    router.dispatch('/async-after', {request: {url: '/async-after'}, response: {}});

    setTimeout(function () {
      test.equal(order, ['action', 'after'], 'onAfterAction must run after the async action completes');
      onComplete();
    }, 60);
  });
}
