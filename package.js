Package.describe({
  name: 'vlasky:galvanized-iron-router',
  summary: 'Galvanized Iron Router - a client/server routing system for Meteor 2.0 and 3.0+',
  version: '2.0.3',
  git: 'https://github.com/vlasky/galvanized-iron-router'
});

Npm.depends({
  'body-parser': '1.20.3'
});

Package.onUse(function (api) {
  api.versionsFrom(['METEOR@2.0', 'METEOR@3.0']);

  // Core Meteor dependencies (consolidated from all packages)
  api.use('underscore');
  api.use('ejson');
  api.use('meteor');
  api.use('random');
  api.use('tracker');

  // Client-side dependencies
  api.use('reactive-var', 'client');
  api.use('reactive-dict', 'client');
  api.use('jquery@1.11.11 || 3.0.0', 'client');

  // UI/Template dependencies
  api.use('blaze@2.4.0 || 3.0.0');
  api.use('templating@1.4.0');

  // Server-side dependencies
  api.use('webapp', 'server');

  // Weak dependencies for migration support (removed for Meteor 3 compatibility)
  // api.use('cmather:iron-core@0.2.0', {weak: true});
  // api.use('cmather:blaze-layout@0.2.5', {weak: true});
  // api.use('cmather:iron-layout@0.2.0', {weak: true});
  api.use('appcache', {weak: true});

  // === LOAD ORDER IS CRITICAL ===

  // 1. IRON-CORE (Foundation)
  api.addFiles('lib/core/iron_core.js');

  // 2. IRON-URL (URL utilities)
  api.addFiles('lib/url/compiler.js');
  api.addFiles('lib/url/url.js');

  // 3. IRON-MIDDLEWARE-STACK (Middleware system)
  api.addFiles('lib/middleware/handler.js');
  api.addFiles('lib/middleware/middleware_stack.js');

  // 4. IRON-DYNAMIC-TEMPLATE (Template system)
  api.addFiles('lib/dynamic-template/dynamic_template.html');
  api.addFiles('lib/dynamic-template/dynamic_template.js');
  api.addFiles('lib/dynamic-template/blaze_overrides.js');

  // 5. IRON-LAYOUT (Layout system)
  api.addFiles('lib/layout/default_layout.html');
  api.addFiles('lib/layout/layout.js');

  // 6. IRON-LOCATION (Location management)
  api.addFiles('lib/location/utils.js', 'client');
  api.addFiles('lib/location/state.js', 'client');
  api.addFiles('lib/location/location.js', 'client');

  // 7. IRON-CONTROLLER (Controller system)
  api.addFiles('lib/controller/wait_list.js', 'client');
  api.addFiles('lib/controller/controller.js');
  api.addFiles('lib/controller/controller_server.js', 'server');
  api.addFiles('lib/controller/controller_client.js', 'client');

  // 8. IRON-ROUTER (Main router)
  api.addFiles('lib/router/version_conflict_error.js');
  api.addFiles('lib/router/current_options.js');
  api.addFiles('lib/router/http_methods.js');
  api.addFiles('lib/router/route_controller.js');
  api.addFiles('lib/router/route_controller_server.js', 'server');
  api.addFiles('lib/router/route_controller_client.js', 'client');
  api.addFiles('lib/router/route.js');
  api.addFiles('lib/router/router.js');
  api.addFiles('lib/router/hooks.js');
  api.addFiles('lib/router/helpers.js');
  api.addFiles('lib/router/router_client.js', 'client');
  api.addFiles('lib/router/body_parser_server.js', 'server');
  api.addFiles('lib/router/router_server.js', 'server');
  api.addFiles('lib/router/plugins.js');
  api.addFiles('lib/router/global_router.js');
  api.addFiles('lib/router/templates.html');

  // Symbol exports (consolidated from all packages)
  api.export('Iron');                    // from iron-core
  api.export('Handler', {testOnly: true}); // from iron-middleware-stack
  api.export(['urlToHashStyle', 'urlFromHashStyle'], 'client', {testOnly: true}); // from iron-location
  api.export('Router');                  // from iron-router
  api.export('RouteController');         // from iron-router
});

Package.onTest(function (api) {
  api.versionsFrom(['METEOR@2.0', 'METEOR@3.0']);

  api.use('vlasky:galvanized-iron-router');
  api.use('tinytest');
  api.use('test-helpers');
  api.use('templating');
  api.use('tracker');
  api.use('blaze');

  // Consolidated test files
  api.addFiles('test/core/iron_core_test.js');
  api.addFiles('test/url/url_test.js', ['client', 'server']);
  api.addFiles('test/middleware/handler_test.js');
  api.addFiles('test/middleware/middleware_stack_test.js');
  api.addFiles('test/middleware/notes.js');
  api.addFiles('test/dynamic-template/dynamic_template_test.html', 'client');
  api.addFiles('test/dynamic-template/dynamic_template_test.js', 'client');
  api.addFiles('test/layout/layout_test.html', 'client');
  api.addFiles('test/layout/layout_test.js', 'client');
  api.addFiles('test/location/location_test.js', 'client');
  api.addFiles('test/controller/controller_test.html', 'client');
  api.addFiles('test/controller/wait_list_test.js', 'client');
  api.addFiles('test/controller/controller_test.js', 'client');
  api.addFiles('test/router/helpers.js');
  api.addFiles('test/router/route_test.js');
  api.addFiles('test/router/router_test.js');
  api.addFiles('test/router/route_controller_test.js');
});
