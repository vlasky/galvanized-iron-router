Package.describe({
  name: 'vlasky:galvanized-iron-router',
  summary: 'Galvanized Iron Router - a client/server routing system for Meteor 2.0 and 3.0+',
  version: '2.3.0',
  git: 'https://github.com/vlasky/galvanized-iron-router'
});

Npm.depends({
  'body-parser': '1.20.3'
});

Package.onUse(function (api) {
  api.versionsFrom(['2.8.1', '3.0']);

  // Required for ES modules
  api.use('ecmascript');

  // TypeScript definitions delivery: publishes index.d.ts (see
  // package-types.json) so tsserver in consuming apps picks up our types
  api.use('zodern:types@1.0.13');

  // Core Meteor dependencies (consolidated from all packages)
  api.use('ejson');
  api.use('meteor');
  api.use('random');
  api.use('tracker');

  // Reactive state (DynamicTemplate uses ReactiveVar on both client and server)
  api.use('reactive-var');
  api.use('reactive-dict', 'client');

  // The router itself no longer uses jQuery. The weak dependency keeps load
  // ordering and version compatibility when the app includes jquery (which
  // Blaze <= 3.0.x still requires at runtime); it does not pull jquery in.
  // Apps that relied on this package to supply jQuery must add it themselves:
  // `meteor add jquery` (a development-mode server startup warning covers
  // this on Meteor 2).
  api.use('jquery@1.11.11 || 3.0.0', 'client', {weak: true});

  // UI/Template dependencies
  api.use('blaze@2.4.0 || 3.0.0');
  api.use('templating@1.4.0');

  // Server-side dependencies
  api.use('webapp', 'server');

  // Weak dependencies for migration support
  api.use('appcache', {weak: true});

  // HTML templates (must be loaded via addFiles)
  api.addFiles('lib/dynamic-template/dynamic_template.html');
  api.addFiles('lib/layout/default_layout.html');
  api.addFiles('lib/router/templates.html');

  // ESM entry points
  api.mainModule('lib/client.js', 'client');
  api.mainModule('lib/server.js', 'server');

  // Backward-compatible exports (globals still work)
  api.export('Iron');
  api.export('Router');
  api.export('RouteController');
  api.export('Handler', {testOnly: true});
  api.export(['urlToHashStyle', 'urlFromHashStyle'], 'client', {testOnly: true});
});

Package.onTest(function (api) {
  api.versionsFrom(['2.8.1', '3.0']);

  api.use('vlasky:galvanized-iron-router');
  api.use('ecmascript');
  api.use('fetch', 'server'); // isomorphic fetch: Meteor 2 (Node 14) has no global fetch
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
  api.addFiles('test/middleware/middleware_stack_dispatch_test.js');
  api.addFiles('test/dynamic-template/dynamic_template_test.html', 'client');
  api.addFiles('test/dynamic-template/dynamic_template_test.js', 'client');
  api.addFiles('test/layout/layout_test.html', 'client');
  api.addFiles('test/layout/layout_test.js', 'client');
  api.addFiles('test/location/location_test.js', 'client');
  api.addFiles('test/controller/controller_test.html', 'client');
  api.addFiles('test/controller/wait_list_test.js', 'client');
  api.addFiles('test/controller/controller_test.js', 'client');
  // Test bootstrap: disables autoStart/autoRender before the router tests load
  api.addFiles('test/router/test_setup.js');
  api.addFiles('test/router/route_test.js');
  api.addFiles('test/router/router_test.js');
  api.addFiles('test/router/route_controller_test.js');
});
