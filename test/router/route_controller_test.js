Tinytest.add('RouteController - lookupOption', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});
  var route = router.route('/', {});
  var inst = route.createController({});
  inst.router = router;
  var value;

  // undefined
  value = inst.lookupOption('myOption');
  test.isUndefined(value, 'property should be undefined');

  // router options
  router.options.myOption = 'myRouterValue';
  value = inst.lookupOption('myOption');
  test.equal(value, 'myRouterValue', 'property should be on router options');

  // XXX: CurrentOptions dynamic var

  // route controller instance
  inst.myOption = 'myInstanceValue';
  value = inst.lookupOption('myOption');
  test.equal(value, 'myInstanceValue', 'property should be on instance');

  // XXX: this order has changed since 0.9.x - either revert or document heavily
  // route controller options : 
  inst.options.myOption = 'myOptionsValue';
  value = inst.lookupOption('myOption');
  test.equal(value, 'myOptionsValue', 'property should be on instance options');

  // route options
  route.options.myOption = 'myRouteValue';
  value = inst.lookupOption('myOption');
  test.equal(value, 'myRouteValue', 'property should be on route options');
});

Tinytest.add('RouteController - lookupOption - class field shadowing', function (test) {
  class FieldController extends Iron.RouteController {
    data() {
      return { title: 'FieldController' };
    }
  }

  var router = new Iron.Router({autoStart: false, autoRender: false});
  var route = router.route('/', {controller: FieldController});
  var inst = route.createController({});
  inst.router = router;
  // Simulate class-field shadowing by adding an own undefined property.
  inst.data = undefined;

  var value = inst.lookupOption('data');
  test.isTrue(typeof value === 'function', 'data should resolve to prototype function even with class field');
  test.equal(value.call(inst).title, 'FieldController', 'data function should be callable');
});

if (Meteor.isClient) {
  Tinytest.add('RouteController - layout data uses controller data function', function (test) {
    class DataController extends Iron.RouteController {
      data() {
        return 'DATA';
      }
    }

    var router = new Iron.Router({autoStart: false, autoRender: false});
    var route = router.route('/layout-data', {
      controller: DataController,
      layoutTemplate: 'LayoutWithData'
    });
    var inst = route.createController({});
    inst.router = router;
    // Simulate class-field shadowing by adding an own undefined property.
    inst.data = undefined;

    const originalDispatch = Iron.MiddlewareStack.prototype.dispatch;
    Iron.MiddlewareStack.prototype.dispatch = function (url, context, done) {
      if (done) done();
    };

    try {
      inst._runRoute(route, '/layout-data');
      test.equal(inst._layout.data(), 'DATA', 'layout should receive controller data');
      // This test isn't about rendering; stop explicitly to avoid warnings.
      inst.stop();
    } finally {
      Iron.MiddlewareStack.prototype.dispatch = originalDispatch;
    }
  });
}

Tinytest.add('RouteController - hooks - inheritance order', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});
  var hookCalls = [];

  router.configure({
    onAfterAction: function routerOnAfterAction() {
      hookCalls.push('routerOnAfterAction');
    }
  });
  
  var Parent = Iron.RouteController.extend({
    onAfterAction: function protoOnAfterAction() {
      hookCalls.push('parentOnAfterAction');
    }
  });

  var C = Parent.extend({
    onAfterAction: function protoOnAfterAction() {
      hookCalls.push('protoOnAfterAction');
    }
  });

  var route = router.route('/', {
    controller: C,
    onAfterAction: function routeOnAfterAction() {
      hookCalls.push('routeOnAfterAction');
    }
  });

  // create some proto hooks
  var c = new C;
  c.router = router;
  c.route = route;

  var hooks = c.runHooks('onAfterAction');

  test.equal(hookCalls[0], 'routerOnAfterAction', 'router onAfterAction');
  test.equal(hookCalls[1], 'routeOnAfterAction', 'route onAfterAction');
  test.equal(hookCalls[2], 'parentOnAfterAction', 'proto onAfterAction');
  test.equal(hookCalls[3], 'protoOnAfterAction', 'proto onAfterAction');
});

Tinytest.add('RouteController - hooks - pausing in before hooks', function (test) {
});
