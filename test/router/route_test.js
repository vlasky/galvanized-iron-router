var Route = Iron.Route;
var RouteController = Iron.RouteController;

Tinytest.add('Route - findControllerConstructor', function (test) {
  var global = Iron.utils.global;
  var route;
  var router = new Iron.Router({autoStart: false, autoRender: false});

  global.FooController = RouteController.extend({
  });

  route = new Route('/foo');
  route.router = router;
  route.handler = {name: 'Foo'};
  test.equal(route.findControllerConstructor(), global.FooController);

  route = new Route('/bar', {controller: 'FooController'});
  route.router = router;
  test.equal(route.findControllerConstructor(), global.FooController);

  route = new Route('/bar');
  route.router = router;
  test.equal(route.findControllerConstructor(), Iron.RouteController);
});

Tinytest.add('Route - findControllerConstructor with registry', function (test) {
  var route;
  var router = new Iron.Router({autoStart: false, autoRender: false});

  // Create a controller that's NOT on the global object
  var RegisteredController = RouteController.extend({});

  // Register it with the router (two-argument form)
  router.registerController('RegisteredController', RegisteredController);

  // Test that the registered controller is found
  route = new Route('/registered', {controller: 'RegisteredController'});
  route.router = router;
  test.equal(route.findControllerConstructor(), RegisteredController,
    'Controller should be resolved from registry');

  // Test registerControllers (array form)
  var AnotherController = RouteController.extend({});
  Object.defineProperty(AnotherController, 'name', { value: 'AnotherController' });
  var YetAnotherController = RouteController.extend({});
  Object.defineProperty(YetAnotherController, 'name', { value: 'YetAnotherController' });

  router.registerControllers([AnotherController, YetAnotherController]);

  route = new Route('/another', {controller: 'AnotherController'});
  route.router = router;
  test.equal(route.findControllerConstructor(), AnotherController,
    'Controller should be resolved from array registration');

  // Test getController
  test.equal(router.getController('RegisteredController'), RegisteredController,
    'getController should return registered controller');
  test.equal(router.getController('NonExistent'), undefined,
    'getController should return undefined for unregistered controller');

  // Test chaining with two-argument form
  var chainRouter = new Iron.Router({autoStart: false, autoRender: false});
  var result = chainRouter
    .registerController('A', RouteController.extend({}))
    .registerController('B', RouteController.extend({}));
  test.equal(result, chainRouter, 'registerController should return router for chaining');

  // Test single-argument form (uses controller.name)
  var NamedController = RouteController.extend({});
  Object.defineProperty(NamedController, 'name', { value: 'NamedController' });

  var namedRouter = new Iron.Router({autoStart: false, autoRender: false});
  namedRouter.registerController(NamedController);
  test.equal(namedRouter.getController('NamedController'), NamedController,
    'Single-argument form should use controller.name as key');

  // Test single-argument form with chaining
  var ChainedController = RouteController.extend({});
  Object.defineProperty(ChainedController, 'name', { value: 'ChainedController' });

  var chainResult = namedRouter.registerController(ChainedController);
  test.equal(chainResult, namedRouter, 'Single-argument form should return router for chaining');
  test.equal(namedRouter.getController('ChainedController'), ChainedController,
    'Chained single-argument registration should work');

  // Test array form of registerControllers
  var ArrayController1 = RouteController.extend({});
  Object.defineProperty(ArrayController1, 'name', { value: 'ArrayController1' });
  var ArrayController2 = RouteController.extend({});
  Object.defineProperty(ArrayController2, 'name', { value: 'ArrayController2' });

  var arrayRouter = new Iron.Router({autoStart: false, autoRender: false});
  var arrayResult = arrayRouter.registerControllers([ArrayController1, ArrayController2]);

  test.equal(arrayResult, arrayRouter, 'Array form should return router for chaining');
  test.equal(arrayRouter.getController('ArrayController1'), ArrayController1,
    'Array form should register first controller');
  test.equal(arrayRouter.getController('ArrayController2'), ArrayController2,
    'Array form should register second controller');
});

Tinytest.add('Router - registerController validation', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});

  test.throws(function () {
    router.registerController('', RouteController.extend({}));
  }, 'Controller name must be a non-empty string.');

  test.throws(function () {
    router.registerController('BadController');
  }, 'Controller must be a function.');

  test.throws(function () {
    router.registerController({});
  }, 'Controller must be a function.');

  test.throws(function () {
    router.registerControllers(RouteController.extend({}));
  }, 'registerControllers expects an array or object of controllers.');
});

Tinytest.add('Route - backward api compat', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});

  try {
    var route = new Route('name');
    test.equal(route._path, '/name', 'name of route as first param with no options should work.');
  } catch (e) {
    test.fail('name of route as first param with no options should work.');
  }

  try {
    var route = router.route('/name');
    test.equal(route._path, '/name', 'path as first param works.');
    test.equal(route.getName(), 'name', 'path as first param converted properly to a name too.');
  } catch (e) {
    test.fail('/name as first param does not work');
  }

  try {
    var route = router.route('withpath', {path: '/with/path'});
    test.equal(route._path, '/with/path', 'path option works');
    test.equal(route.getName(), 'withpath', 'first param name with path option works');
  } catch (e) {
    test.fail('first param name with a path option does not work');
  }
});

Tinytest.add('Route - callable name is blank so handler names derive from path', function (test) {
  var router = new Iron.Router({autoStart: false, autoRender: false});

  var one = router.route('/one');
  var two = router.route('/two');

  // If the callable route has a non-empty function name, Handler prefers fn.name
  // over the URL path and multiple routes can collide under minification.
  test.equal(one.name, '', 'route callable function name should be blank');
  test.equal(two.name, '', 'route callable function name should be blank');
  test.equal(one.getName(), 'one', 'route name should derive from path');
  test.equal(two.getName(), 'two', 'route name should derive from path');
});
