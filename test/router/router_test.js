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

if (Meteor.isClient) {
  Tinytest.add('Router - dispatch - onRun and onRerun hooks see query params (GH #6)', function (test) {
    // onRun and onRerun hooks run in their own nested MiddlewareStack. That
    // stack must be dispatched with the full url: by the time the outer
    // onRun/onRerun handler runs, req.url has been rewritten to the
    // normalized, mount-relative path, and dispatching the nested stack with
    // it re-parses params from a url with no query string or hash, merging an
    // empty query over the controller's params for the duration of the hooks.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var rerun = new Tracker.Dependency;
    var seen = {};

    var snapshot = function (controller) {
      return {
        id: controller.params.id,
        query: Object.assign({}, controller.params.query),
        hash: controller.params.hash
      };
    };

    router.route('/items/:id', {
      onRun: function () {
        seen.onRun = snapshot(this);
        this.next();
      },
      onRerun: function () {
        seen.onRerun = snapshot(this);
        this.next();
      },
      action: function () {
        rerun.depend();
        seen.action = snapshot(this);
        // This test isn't about rendering; stop explicitly (once the rerun
        // has happened) to avoid warnings.
        if (seen.onRerun)
          this.stop();
      }
    });

    router.dispatch('/items/42?token=abc&list[]=1&list[]=2#frag', {});

    var expected = {id: '42', query: {token: 'abc', list: ['1', '2']}, hash: 'frag'};
    test.equal(seen.onRun, expected, 'onRun hook params');
    test.equal(seen.action, expected, 'action params');

    rerun.changed();
    Tracker.flush();

    test.equal(seen.onRerun, expected, 'onRerun hook params');
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - dispatch - a reused controller is no longer stopped', function (test) {
    // A same-route navigation stops the controller and re-dispatches the same
    // instance. isStopped used to stay true, so the beginRendering callback
    // returned early and never cleared the regions the new run left unused.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var stops = 0;

    router.route('/items/:id', {
      onStop: function () { stops++; },
      action: function () {
        if (this.params.id === '1') {
          this.render('ItemOne');
          this.render('ItemAside', {to: 'aside'});
        } else {
          // a different main template: unused regions must be cleared
          this.render('ItemTwo');
        }
      }
    });

    var controller = router.dispatch('/items/1', {});
    Tracker.flush();
    test.isFalse(controller.isStopped, 'running after the first dispatch');
    test.isTrue(controller._layout.has('aside'), 'aside rendered for item 1');

    var again = router.dispatch('/items/2', {});
    test.equal(again, controller, 'same controller instance');
    test.equal(stops, 1, 'onStop ran once for the first run');
    test.isFalse(controller.isStopped, 'the reused controller is running again');
    Tracker.flush();
    test.isFalse(!!(controller._layout._regions.aside && controller._layout._regions.aside.template()),
      'the aside region was cleared when the main template changed');

    controller.stop();
    controller.stop();
    test.equal(stops, 2, 'stopping an already stopped controller does not rerun onStop');
    test.isTrue(controller.isStopped);
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - dispatch - a rerun of the controller computation sees a hash-only change', function (test) {
    // Router.start()'s location autorun handles a hash-only change by
    // reconfiguring the current controller (configureFromUrl) without
    // re-dispatching. The controller's computation used to dispatch with the
    // url captured when it was created, and dispatch merges the params it
    // parses from that url over this.params, so any rerun put the old hash
    // back.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var rerun = new Tracker.Dependency;
    var seen = [];

    router.route('/items/:id', function () {
      rerun.depend();
      seen.push({id: this.params.id, hash: this.params.hash, v: this.params.query.v});
      // not about rendering; stop once the rerun has been observed
      if (seen.length === 2)
        this.stop();
    });

    var controller = router.dispatch('/items/1?v=a#old', {});
    Tracker.flush();
    test.equal(seen[0], {id: '1', hash: 'old', v: 'a'});

    controller.configureFromUrl('/items/1?v=a#new');
    rerun.changed();
    Tracker.flush();
    test.equal(seen[1], {id: '1', hash: 'new', v: 'a'}, 'the rerun sees the new hash');
  });

  Tinytest.add('Router - a url the client cannot handle goes to the server, replacing the history entry when asked (upstream #1471)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var calls = [];

    // the only route is a server one, so nothing is handled on the client
    router.route('/(.*)', function () {}, {where: 'server'});
    router._goToServer = function (url, replace) {
      calls.push({url: url, replace: replace});
    };

    var originalHref = location.href;
    var originalState = history.state;
    try {
      // a location with the {initial: true} history state renders the
      // not-found template instead of going to the server; make sure this
      // test does not depend on what earlier tests left in the state
      Iron.Location.go(location.href, {replaceState: true, historyState: {}});
      Tracker.flush();
      // ...without that seeding counting as a replaceState navigation itself
      Tracker.nonreactive(function () { Iron.Location.get().options.replaceState = false; });

      router.start();
      Tracker.flush();
      test.equal(calls.length, 1, 'the current url is handed to the server on start');
      test.equal(calls[0].replace, false, 'a plain navigation keeps the history entry');

      router.go('/server-only/file?x=1#frag', null, {replaceState: true});
      Tracker.flush();
      test.equal(calls.length, 2);
      test.equal(calls[1], {url: '/server-only/file?x=1#frag', replace: true}, 'replaceState is honoured and the fragment kept');

      router.go('/server-only/other');
      Tracker.flush();
      test.equal(calls[2], {url: '/server-only/other', replace: false});
      test.equal(location.href, originalHref, 'the url change was cancelled in favour of the server');
    } finally {
      router.stop();
      // Location.go recorded the cancelled states as current; put it back
      Iron.Location.go(originalHref, {replaceState: true, historyState: originalState});
      Tracker.flush();
    }
  });

  Tinytest.add('Router - the dispatched url is relative however the location was reached (upstream #1152)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var urls = [];
    var originalHref = location.href;
    var ownPush = Object.getOwnPropertyDescriptor(history, 'pushState');
    var ownReplace = Object.getOwnPropertyDescriptor(history, 'replaceState');

    history.pushState = function () {};
    history.replaceState = function () {};

    // matches the test page's url and anything else we go to
    router.route('/(.*)', function () {
      urls.push(this.url);
    });

    try {
      // the initial location comes from location.href, which is absolute
      router.start();
      Tracker.flush();
      test.equal(urls[0], location.pathname + location.search + location.hash, 'the initial url is relative');

      router.go('/relative-url-test/1?x=1#frag');
      Tracker.flush();
      test.equal(urls[1], '/relative-url-test/1?x=1#frag', 'a url given to go() is dispatched as is');

      // a popstate builds the state from the absolute location.href too
      Iron.Location.go(location.origin + '/relative-url-test/2?y=2');
      Tracker.flush();
      test.equal(urls[2], '/relative-url-test/2?y=2', 'an absolute url is dispatched relative');
      test.equal(router.current().url, '/relative-url-test/2?y=2');
    } finally {
      router.stop();
      Iron.Location.go(originalHref, {replaceState: true, historyState: history.state});
      Tracker.flush();
      if (ownPush) Object.defineProperty(history, 'pushState', ownPush); else delete history.pushState;
      if (ownReplace) Object.defineProperty(history, 'replaceState', ownReplace); else delete history.replaceState;
    }
  });

  Tinytest.add('Router - start after stop runs the current route again', function (test) {
    // start()'s autorun saw a (stopped) current controller and no previous
    // location, so it only reconfigured it: the route stayed stopped and
    // inert until the path changed.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var runs = 0;

    // matches whatever url the test page is at
    router.route('/(.*)', function () {
      runs++;
      this.stop();
    });

    try {
      router.start();
      Tracker.flush();
      test.equal(runs, 1, 'the current url is routed on start');

      router.stop();
      router.start();
      Tracker.flush();
      test.equal(runs, 2, 'restarting the router routes the current url again');
    } finally {
      router.stop();
    }
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - yieldRegions data follows the current controller and leaves the options untouched', function (test) {
    // render() used to write the route's data function onto the yieldRegions
    // entry itself and Controller.render then bound it in place. The region
    // stayed bound to the first controller instance (so a later visit showed
    // the first visit's data) and every render nested another wrapper.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var asideOptions = {to: 'aside'};

    router.route('/post/:id', {
      template: 'Post',
      yieldRegions: {PostAside: asideOptions},
      data: function () { return {id: this.params.id}; }
    });
    router.route('/elsewhere', function () {
      this.render('Elsewhere');
    });

    var first = router.dispatch('/post/1', {});
    Tracker.flush();
    var aside = first._layout._regions.aside;
    test.equal(aside.data().id, '1', 'region data for the first visit');

    router.dispatch('/elsewhere', {});
    Tracker.flush();
    var third = router.dispatch('/post/2', {});
    Tracker.flush();
    test.notEqual(third, first, 'a new controller instance after visiting another route');
    test.equal(aside.data().id, '2', 'region data follows the current controller');
    test.equal(asideOptions, {to: 'aside'}, 'the yieldRegions entry is not mutated');

    // explicit falsy region data is data, not an invitation to substitute the
    // route's data function; and the caller's options object stays untouched
    var explicit = {to: 'footer', data: null};
    third.render('PostFooter', explicit);
    test.isNull(third._layout._regions.footer.data(), 'explicit null region data survives');
    test.equal(explicit, {to: 'footer', data: null}, 'render() did not write the bound wrapper back onto the options');
    var zero = {to: 'footer', data: 0};
    third.render('PostFooter', zero);
    test.equal(third._layout._regions.footer.data(), 0, 'explicit 0 region data survives');

    third.stop();
  });
}

if (Meteor.isClient) {
  Tinytest.addAsync('Router - a stopped controller no longer renders into the shared layout', function (test, onComplete) {
    // An async action that settles after navigation used to overwrite the
    // new route's region and layout.
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var slow;

    router.route('/slow', function () {
      slow = this;
      this.render('Slow');
      setTimeout(function () {
        slow.render('Late');
        slow.layout('LateLayout');
        slow.render('LateAside', {to: 'aside'});
      }, 5);
    });
    router.route('/fast', function () {
      this.render('Fast');
    });

    router.dispatch('/slow', {});
    Tracker.flush();
    router.dispatch('/fast', {});
    Tracker.flush();

    setTimeout(function () {
      var layout = router._layout;
      test.isTrue(slow.isStopped, 'the slow controller was stopped by the navigation');
      test.equal(layout._regions.main.template(), 'Fast', 'main region still shows the current route');
      test.notEqual(layout.template(), 'LateLayout', 'the layout template was not switched');
      test.isFalse(layout.has('aside'), 'no region was created by the late render');
      router._currentController.stop();
      onComplete();
    }, 25);
  });
}

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
    // Under the stock Tinytest drivers the test client always contains jquery
    // (they depend on it), so the manifest check must report true on every
    // Meteor version - this is exactly the case the server Package namespace
    // gets wrong, since the driver's jquery dependency is client-only. The
    // jQuery-free driver in test/drivers brings none, so there it must report
    // false.
    var driverBringsJquery = !Package['tinytest-plain-driver'];
    test.equal(Iron.Router._clientBundleHasJquery(), driverBringsJquery,
      'detection matches whether the test driver brings jquery into the client bundle');
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

  // An onAfterAction that throws after an async action used to surface as an
  // unhandled rejection inside the drain callback (process exit on Node 15+);
  // an async after hook that rejects was unhandled on every path.
  // (A throwing sync hook still stops the hooks after it, as it always has,
  // so the two failure modes get a route each.)
  var afterHookFailures = [];
  var asyncAction = async function () {
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify({ok: true}));
  };
  Router.route('/test-async-after-throws', {
    where: 'server',
    onAfterAction: function () { afterHookFailures.push('sync'); throw new Error('sync after hook failed'); }
  }).get(asyncAction);
  Router.route('/test-async-after-rejects', {
    where: 'server',
    onAfterAction: async function () { afterHookFailures.push('async'); throw new Error('async after hook failed'); }
  }).get(asyncAction);

  Tinytest.addAsync('Router - server - throwing after hooks behind an async action do not crash the process', function (test, onComplete) {
    var unhandled = [];
    var logged = [];
    var onUnhandled = function (reason) { unhandled.push(reason); };
    var origError = console.error;

    afterHookFailures.length = 0;
    process.on('unhandledRejection', onUnhandled);
    console.error = function () { logged.push(String(arguments[1] || arguments[0])); };

    fetch(Meteor.absoluteUrl('test-async-after-throws')).then(function (res) {
      test.equal(res.status, 200, 'the action with the throwing hook responded normally');
      return fetch(Meteor.absoluteUrl('test-async-after-rejects'));
    }).then(function (res) {
      test.equal(res.status, 200, 'the action with the rejecting hook responded normally');
      // give the drain callbacks and the rejected hook promise a tick to settle
      return new Promise(function (resolve) { setTimeout(resolve, 30); });
    }).then(function () {
      test.equal(afterHookFailures, ['sync', 'async'], 'both after hooks ran');
      test.equal(unhandled.length, 0, 'no unhandled rejection');
      test.isTrue(logged.some(function (m) { return /sync after hook failed/.test(m); }), 'sync hook failure logged');
      test.isTrue(logged.some(function (m) { return /async after hook failed/.test(m); }), 'async hook rejection logged');
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
    }).then(function () {
      console.error = origError;
      process.removeListener('unhandledRejection', onUnhandled);
      onComplete();
    });
  });

  // The body parsers are callback-style: they return before the body has
  // been read and call next() later. The route's after hooks used to run as
  // soon as the dispatch returned, i.e. before the action and before
  // request.body existed.
  var afterOrder = [];
  Router.route('/test-after-hook-order', {
    where: 'server',
    onAfterAction: function () {
      afterOrder.push('after:' + (this.request.body && this.request.body.n));
    }
  }).post(function () {
    afterOrder.push('action:' + (this.request.body && this.request.body.n));
    this.response.setHeader('Content-Type', 'application/json');
    this.response.end(JSON.stringify({ok: true}));
  });

  Tinytest.addAsync('Router - server - after hooks run after the action when the body is streamed', function (test, onComplete) {
    afterOrder.length = 0;
    fetch(Meteor.absoluteUrl('test-after-hook-order'), {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({n: 7})
    }).then(function (res) {
      test.equal(res.status, 200);
      return new Promise(function (resolve) { setTimeout(resolve, 20); });
    }).then(function () {
      test.equal(afterOrder, ['action:7', 'after:7'], 'the action runs first and the after hook sees the parsed body');
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
    }).then(onComplete);
  });

  // A GET has no body: the parsers call next() synchronously and the route
  // keeps its synchronous completion (after hooks run before dispatch
  // returns). A microtask queued by the action must therefore run AFTER the
  // after hook; a wrapper that always returned a promise would defer the
  // hook past it.
  var getOrder = [];
  Router.route('/test-after-hook-order-get', {
    where: 'server',
    onAfterAction: function () { getOrder.push('after'); }
  }).get(function () {
    getOrder.push('action');
    Promise.resolve().then(function () { getOrder.push('microtask'); });
    this.response.end('ok');
  });

  Tinytest.addAsync('Router - server - after hooks still run for a bodiless request', function (test, onComplete) {
    getOrder.length = 0;
    fetch(Meteor.absoluteUrl('test-after-hook-order-get')).then(function (res) {
      test.equal(res.status, 200);
      return new Promise(function (resolve) { setTimeout(resolve, 20); });
    }).then(function () {
      test.equal(getOrder, ['action', 'after', 'microtask'], 'the after hook ran synchronously, before a microtask queued by the action');
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
    }).then(onComplete);
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

  // an integer name is an array index: aliasing it made the routes array
  // sparse (length 405 after /404) and findFirstRoute threw on the holes on
  // every dispatch (upstream #986, #1188)
  router.route('/404', function () {});
  router.route('/5', function () {});
  router.route('/01', function () {});
  test.equal(router.routes.length, 7, 'integer-named routes do not make the routes array sparse');
  test.isTrue(!!router.findRouteByName('404'), 'route named 404 is addressable by name');
  test.isUndefined(router.routes['404'], 'an array index is not aliased');
  test.isTrue(!!router.routes['01'], 'a digit string that is not an array index keeps its alias');
  var found = router.findFirstRoute('/ordinary');
  if (Meteor.isClient)
    test.equal(found && found.getName(), 'ordinary', 'findFirstRoute still walks the routes array');
  else
    test.isNull(found, 'findFirstRoute walks the routes array without throwing');
});

if (Meteor.isClient) {
  Tinytest.add('Router - go with a path applies the query and hash options (upstream #1610)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var go = Iron.Location.go;
    var calls = [];

    Iron.Location.go = function (path, options) {
      calls.push({path: path, options: options});
    };

    try {
      router.go('/items', null, {query: {a: 1, b: 'x y'}, hash: 'top'});
      router.go('/items?a=1', null, {query: {b: 2}});
      router.go('/items#old', null, {hash: 'new'});
      router.go('/items#old', null, {hash: ''});
      router.go('/items', null, {replaceState: true});
      router.go('http://example.com/items', null, {query: {a: 1}});
      router.go('/items?tag=a&tag=b&flag', null, {hash: 'top'});
      router.go('/items#section?detail=1', null, {query: {a: 1}});
      router.go('https://User:Secret@example.com/items', null, {query: {a: 1}});
      router.go('/items?', null, {query: {a: 1}});
    } finally {
      Iron.Location.go = go;
    }

    test.equal(calls[0].path, '/items?a=1&b=x%20y#top', 'query and hash are appended to a path');
    test.equal(calls[1].path, '/items?a=1&b=2', 'the query option is appended to a query in the path');
    test.equal(calls[2].path, '/items#new', 'the hash option replaces a hash in the path');
    test.equal(calls[3].path, '/items', 'an empty hash option removes the hash');
    test.equal(calls[4].path, '/items', 'a path without query or hash options is untouched');
    test.isTrue(calls[4].options.replaceState, 'other options still reach Location.go');
    test.equal(calls[5].path, 'http://example.com/items?a=1', 'an absolute url keeps its origin');
    test.equal(calls[6].path, '/items?tag=a&tag=b&flag#top', 'repeated keys and bare flags in the path survive');
    test.equal(calls[7].path, '/items?a=1#section?detail=1', 'a fragment containing ? is left alone');
    test.equal(calls[8].path, 'https://User:Secret@example.com/items?a=1', 'credentials keep their case');
    test.equal(calls[9].path, '/items?a=1', 'a path ending in ? gets no empty key');
  });

  Tinytest.add('Router - the loading plugin template is used when a route has waitOn (upstream #1148)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var CustomLoading = new Template('RouterTestCustomLoading', function () { return 'custom loading'; });
    var Loaded = new Template('RouterTestLoaded', function () { return 'loaded'; });
    var isReady = false;
    var readyDep = new Tracker.Dependency;
    var handle = {ready: function () { readyDep.depend(); return isReady; }};

    router.plugin('loading', {loadingTemplate: CustomLoading});
    router.route('/wait', {
      waitOn: function () { return handle; },
      action: function () { this.render(Loaded); }
    });

    router.dispatch('/wait', {});
    Tracker.flush();
    test.equal(router._layout._regions.main.template(), CustomLoading,
      'the plugin loadingTemplate renders while the waitOn is not ready');

    isReady = true;
    readyDep.changed();
    Tracker.flush();
    test.equal(router._layout._regions.main.template(), Loaded, 'the route renders once ready');

    router._currentController.stop();
  });

  Tinytest.add('Router - current() observers are invalidated before the dispatch runs (upstream #1253)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var invalidatedDuringAction = null;
    var comp = Tracker.autorun(function () { router.current(); });

    router.route('/first', function () {
      invalidatedDuringAction = comp.invalidated;
      this.stop();
    });

    try {
      router.dispatch('/first', {});
      test.isTrue(invalidatedDuringAction,
        'the dependency changed together with the value, not after the action');
    } finally {
      comp.stop();
      if (router._currentController)
        router._currentController.stop();
    }
  });
}

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

// A client route the server knows about (shared code), for the catch-all 404
// test below: the catch-all must hand urls like this one on to Meteor.
Router.route('/test-404/client-page', function () {});

if (Meteor.isServer) {
  // The Guide's recipe for answering unknown urls with a 404, scoped under
  // /test-404/ so it cannot swallow the other test routes or the test page.
  Router.route('/test-404/(.*)', function () {
    if (this.willBeHandledOnClient())
      return this.next();

    this.response.statusCode = 404;
    this.response.setHeader('Content-Type', 'text/plain');
    this.response.end('Not found\n');
  }, {where: 'server'});

  Tinytest.addAsync('Router - server - a catch-all server route can answer unknown urls with a 404', function (test, onComplete) {
    fetch(Meteor.absoluteUrl('test-404/missing-page')).then(function (res) {
      test.equal(res.status, 404, 'an unknown url under the catch-all gets a 404');
      return fetch(Meteor.absoluteUrl('test-404/client-page'));
    }).then(function (res) {
      test.equal(res.status, 200, 'a url with a client route is still served by Meteor');
      return res.text();
    }).then(function (html) {
      test.isTrue(/<html/i.test(html), 'the client application was served');
      onComplete();
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
      onComplete();
    });
  });

  // a server route that passes the request on is a matched route, not an
  // unknown url, so it must not get the status
  Router.route('/test-not-found-status/passthrough', function () {
    this.next();
  }, {where: 'server'});

  Tinytest.addAsync('Router - server - notFoundStatusCode sets the status of the app shell for unknown urls', function (test, onComplete) {
    // No test route matches /test-not-found-status/..., so these requests fall
    // through to Meteor. The option is global, so it is set only for the
    // duration of the test (the test page's own url would get it too).
    const previous = Router.options.notFoundStatusCode;
    const finish = function () {
      Router.configure({notFoundStatusCode: previous === undefined ? null : previous});
      onComplete();
    };

    Router.configure({notFoundStatusCode: 404});
    fetch(Meteor.absoluteUrl('test-not-found-status/missing-page')).then(function (res) {
      test.equal(res.status, 404, 'an unknown url gets the configured status');
      test.isTrue(/text\/html/.test(res.headers.get('content-type') || ''), 'the response is the html app shell');
      return res.text();
    }).then(function (html) {
      test.isTrue(/<html/i.test(html), 'the client application is served with the 404');
      return fetch(Meteor.absoluteUrl('test-404/client-page'));
    }).then(function (res) {
      test.equal(res.status, 200, 'a url with a client route is still a 200');
      return fetch(Meteor.absoluteUrl('test-not-found-status/passthrough'));
    }).then(function (res) {
      test.equal(res.status, 200, 'a server route that passed the request on is not an unknown url');
      Router.configure({notFoundStatusCode: null});
      return fetch(Meteor.absoluteUrl('test-not-found-status/missing-page'));
    }).then(function (res) {
      test.equal(res.status, 200, 'a null option restores the default 200');
      finish();
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
      finish();
    });
  });
}

if (Meteor.isServer) {
  // Router.use: a pathless middleware runs for every server request (scoped
  // here to /test-use/ urls by hand), and a four-argument one is an error
  // handler for the routes registered before it (upstream PR #1477).
  Router.use(function (req, res, next) {
    if (req.originalUrl.indexOf('/test-use/') === 0)
      res.setHeader('X-Test-Use', 'middleware');
    next();
  });

  Router.route('/test-use/throws', function () {
    throw new Error('route failure');
  }, {where: 'server'});

  Router.route('/test-use/async-rejects', async function () {
    await Promise.resolve();
    throw new Error('async route failure');
  }, {where: 'server'});

  Router.use('/test-use/mounted', function (req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({mounted: req.url, original: req.originalUrl}));
  });

  Router.use(function (err, req, res, next) {
    // other tests expect the router's own 500 handling for their errors
    if (req.originalUrl.indexOf('/test-use/') !== 0)
      return next(err);
    res.statusCode = 422;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({error: err.message}));
  });

  Tinytest.addAsync('Router - server - Router.use registers middleware and error handlers (upstream #1477)', function (test, onComplete) {
    fetch(Meteor.absoluteUrl('test-use/throws')).then(function (res) {
      test.equal(res.status, 422, 'the error handler answered a throwing route');
      test.equal(res.headers.get('x-test-use'), 'middleware', 'the pathless middleware ran first');
      return res.json();
    }).then(function (body) {
      test.equal(body, {error: 'route failure'});
      return fetch(Meteor.absoluteUrl('test-use/async-rejects'));
    }).then(function (res) {
      test.equal(res.status, 422, 'the error handler answered a rejecting async route');
      return res.json();
    }).then(function (body) {
      test.equal(body, {error: 'async route failure'});
      return fetch(Meteor.absoluteUrl('test-use/mounted/users?x=1'));
    }).then(function (res) {
      test.equal(res.status, 200);
      return res.json();
    }).then(function (body) {
      test.equal(body, {mounted: '/users?x=1', original: '/test-use/mounted/users?x=1'}, 'a mounted middleware sees the url below its mount point');
      // the pathless middleware ran for this unknown url too and called
      // next(); the request must still be handed on to Meteor
      return fetch(Meteor.absoluteUrl('test-use-unknown/page'));
    }).then(function (res) {
      test.equal(res.status, 200, 'an unknown url is still served by Meteor');
      return res.text();
    }).then(function (html) {
      test.isTrue(/<html/i.test(html), 'the client application was served');
      // errors outside the handler's scope keep the router's 500 handling
      return fetch(Meteor.absoluteUrl('test-async-error'));
    }).then(function (res) {
      test.equal(res.status, 500, 'an error passed on with next(err) reaches the default handling');
      onComplete();
    }).catch(function (err) {
      test.fail('request failed: ' + err.message);
      onComplete();
    });
  });
}

Tinytest.add('Router - path and url carry the configured rootUrlPathPrefix (upstream #800)', function (test) {
  var router = new Iron.Router({autoRender: false, autoStart: false});
  var origin = Meteor.absoluteUrl().replace(/^([a-z]+:\/\/[^/]+).*$/i, '$1');

  router.route('/prefix-test/:id', {name: 'prefixTest'});

  try {
    test.equal(router.path('prefixTest', {id: 1}), '/prefix-test/1', 'no prefix by default');
    test.equal(router.url('prefixTest', {id: 1}), origin + '/prefix-test/1');

    router.configure({rootUrlPathPrefix: '/beta'});
    test.equal(router.path('prefixTest', {id: 1}, {query: {x: 1}}), '/beta/prefix-test/1?x=1', 'paths carry the prefix');
    test.equal(router.url('prefixTest', {id: 1}), origin + '/beta/prefix-test/1', 'urls carry it once');
    test.equal(router.url('prefixTest', {id: 1}, {host: 'https://other.example/'}), 'https://other.example/beta/prefix-test/1');
    test.equal(router.url('prefixTest', {id: 1}, {host: 'https://other.example/beta/'}), 'https://other.example/beta/prefix-test/1', 'a host given with the prefix does not repeat it');
    test.equal(router.url('prefixTest', {id: 1}, {host: 'https://other.example/base'}), 'https://other.example/base/beta/prefix-test/1', 'an unrelated base path is kept');

    router.configure({rootUrlPathPrefix: false});
    test.equal(router.path('prefixTest', {id: 2}), '/prefix-test/2', 'false opts out of the prefix');

    test.throws(function () {
      router.configure({rootUrlPathPrefix: 42});
    }, /rootUrlPathPrefix/);
  } finally {
    router.configure({rootUrlPathPrefix: null});
  }
});

if (Meteor.isClient) {
  Tinytest.add('Router - navigation under a rootUrlPathPrefix matches application routes (upstream #800)', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var seen = [];
    var originalHref = location.href;
    var ownPush = Object.getOwnPropertyDescriptor(history, 'pushState');
    var ownReplace = Object.getOwnPropertyDescriptor(history, 'replaceState');
    var pushed = [];

    // nothing is written to the real history
    history.pushState = function (state, title, url) { pushed.push(url); };
    history.replaceState = function () {};

    router.route('/prefix-nav/:id', function () {
      seen.push({id: this.params.id, pathname: Iron.Url.parse(this.url).pathname});
    }, {name: 'prefixNav'});
    // matches the test page's own url so start() does not hand off to the server
    router.route('/(.*)', function () {});
    router._goToServer = function (url) { seen.push({server: url}); };

    try {
      router.configure({rootUrlPathPrefix: '/beta'});
      // the test page itself sits outside /beta: such a url is not routed
      // but left to the browser (Meteor would answer it with "Unknown path")
      router.start();
      Tracker.flush();
      test.equal(seen[0], {server: location.pathname + location.search + location.hash}, 'a browser url outside the prefix goes to the server');

      router.go('/prefix-nav/1');
      Tracker.flush();
      test.equal(seen[1], {id: '1', pathname: '/prefix-nav/1'}, 'an application path given to go() is routed without the prefix');
      test.equal(Iron.Location.get().path, '/beta/prefix-nav/1', 'the browser location carries the prefix');
      test.equal(pushed, ['/beta/prefix-nav/1'], 'the pushed url carries the prefix');

      router.go('prefixNav', {id: 2});
      Tracker.flush();
      test.equal(seen[2], {id: '2', pathname: '/prefix-nav/2'}, 'a route name is routed the same way');
      test.equal(Iron.Location.get().path, '/beta/prefix-nav/2');

      // a browser url (a link click) arrives with the prefix already on it
      Iron.Location.go('/beta/prefix-nav/3');
      Tracker.flush();
      test.equal(seen[3], {id: '3', pathname: '/prefix-nav/3'}, 'a prefixed browser url is routed without the prefix');

      // Router.path() output is a browser path and is accepted as such
      router.go(router.path('prefixNav', {id: 4}));
      Tracker.flush();
      test.equal(seen[4], {id: '4', pathname: '/prefix-nav/4'}, 'go() with a prefixed path does not double the prefix');

      // a path outside the prefix and an absolute url elsewhere are not routed
      Iron.Location.go('/prefix-nav/5');
      Tracker.flush();
      test.equal(seen[5], {server: '/prefix-nav/5'}, 'a browser path outside the prefix goes to the server');
      router.go('https://other.example/beta/prefix-nav/6');
      Tracker.flush();
      test.equal(seen[6], {server: 'https://other.example/beta/prefix-nav/6'}, 'an absolute url on another origin is left to the browser whole');
      test.equal(seen.length, 7);
    } finally {
      router.stop();
      router.configure({rootUrlPathPrefix: null});
      Iron.Location.go(originalHref, {replaceState: true, historyState: history.state});
      Tracker.flush();
      if (ownPush) Object.defineProperty(history, 'pushState', ownPush); else delete history.pushState;
      if (ownReplace) Object.defineProperty(history, 'replaceState', ownReplace); else delete history.replaceState;
    }
  });
}

Tinytest.add('Router - a client route and a server route may share a path (upstream #1091)', function (test) {
  var router = new Iron.Router({autoRender: false, autoStart: false});

  router.route('/shared-path', function () {}, {name: 'sharedClient'});
  router.route('/shared-path', function () {}, {name: 'sharedServer', where: 'server'});
  test.equal(router.findRouteByName('sharedClient').handler.where, 'client');
  test.equal(router.findRouteByName('sharedServer').handler.where, 'server');

  // without explicit names both routes derive the same name from the path
  test.throws(function () {
    router.route('/shared-default', function () {});
    router.route('/shared-default', function () {}, {where: 'server'});
  }, /Handler with name 'shared-default' already exists/);

  test.throws(function () {
    router.route('/shared-path', function () {}, {name: 'sharedClientAgain'});
  }, /client route for the path "\/shared-path" already exists by the name of "sharedClient"/);
  test.throws(function () {
    router.route('/shared-path', function () {}, {name: 'sharedServerAgain', where: 'server'});
  }, /server route for the path "\/shared-path" already exists by the name of "sharedServer"/);
});

Tinytest.add('Router - route rejects the options object before the function', function (test) {
  var router = new Iron.Router({autoRender: false, autoStart: false});

  test.throws(function () {
    router.route('/wrong-order', {name: 'wrongOrder'}, function () {});
  }, /route function must come before the options object/);
  test.isUndefined(router.findRouteByName('wrongOrder'), 'no route was defined');
});

if (Meteor.isServer) {
  // no function, no action option, no REST handlers: a request used to hang
  Router.route('/test-no-action', {where: 'server', name: 'testNoAction'});

  // the same with an async before hook: the route's frame has already been
  // marked handled when the default action runs, which must not turn the
  // hand-off into the "no client routes" notice
  Router.route('/test-no-action-async', {where: 'server', name: 'testNoActionAsync'});
  Router.onBeforeAction(async function () {
    await new Promise(function (resolve) { setTimeout(resolve, 5); });
    this.next();
  }, {only: ['testNoActionAsync']});

  Tinytest.addAsync('Router - server - a route with no action passes the request on with a warning', function (test, onComplete) {
    var warnings = [];
    var originalWarn = console.warn;
    console.warn = function (message) { warnings.push(String(message)); };

    fetch(Meteor.absoluteUrl('test-no-action')).then(function (res) {
      test.equal(res.status, 200, 'the request was answered');
      return res.text();
    }).then(function (body) {
      test.isTrue(/<html/i.test(body), 'the request was handed on to Meteor, which served the client application');
      test.isTrue(warnings.some(function (w) { return /"testNoAction" has no action/.test(w); }), 'a development warning names the route');
      return fetch(Meteor.absoluteUrl('test-no-action-async'));
    }).then(function (res) {
      test.equal(res.status, 200);
      return res.text();
    }).then(function (body) {
      test.isTrue(/<html/i.test(body), 'handed on to Meteor after an async before hook too');
      console.warn = originalWarn;
      onComplete();
    }).catch(function (err) {
      console.warn = originalWarn;
      test.fail('request failed: ' + err.message);
      onComplete();
    });
  });
}

if (Meteor.isClient) {
  Tinytest.add('Router - use with where client runs middleware in the client dispatch', function (test) {
    var router = new Iron.Router({autoRender: false, autoStart: false});
    var seen = [];

    router.use(function (req, res, next) {
      seen.push(this.url);
      this.next();
    }, {where: 'client'});
    router.route('/client-use/:id', function () {
      seen.push('route ' + this.params.id);
    });

    var controller = router.dispatch('/client-use/7', {});
    Tracker.flush();
    test.equal(seen, ['/client-use/7', 'route 7']);
    controller.stop();
  });
}

Tinytest.add('Router - use requires a function', function (test) {
  test.throws(function () { Router.use('/x'); }, /function/);
  test.throws(function () { Router.use(42, function () {}); }, /path/);
});

Tinytest.add('Router - configure rejects an invalid notFoundStatusCode', function (test) {
  const previous = Router.options.notFoundStatusCode;
  try {
    [200, '404', 404.5, true, 600].forEach(function (value) {
      test.throws(function () {
        Router.configure({notFoundStatusCode: value});
      }, /notFoundStatusCode/);
    });
    test.equal(Router.options.notFoundStatusCode, previous, 'a rejected value is not stored');
    Router.configure({notFoundStatusCode: 410});
    test.equal(Router.options.notFoundStatusCode, 410);
    Router.configure({notFoundStatusCode: null});
    test.equal(Router.options.notFoundStatusCode, null);
  } finally {
    Router.configure({notFoundStatusCode: previous === undefined ? null : previous});
  }
});
