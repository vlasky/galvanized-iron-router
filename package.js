Package.describe({
  name: 'vlasky:galvanized-iron-router',
  summary: 'Galvanized Iron Router - a client/server routing system for Meteor 2.0 and 3.0+',
  version: '2.1.2',
  git: 'https://github.com/vlasky/galvanized-iron-router',
  types: 'index.d.ts'
});

Npm.depends({
  'body-parser': '1.20.3'
});

Package.onUse(function (api) {
  api.versionsFrom(['2.8.1', '3.0']);

  // Required for ES modules
  api.use('ecmascript');

  // Core Meteor dependencies (consolidated from all packages)
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

  // Weak dependencies for migration support
  api.use('appcache', {weak: true});

  // HTML templates (must be loaded via addFiles)
  api.addFiles('lib/dynamic-template/dynamic_template.html');
  api.addFiles('lib/layout/default_layout.html');
  api.addFiles('lib/router/templates.html');

  // ESM entry points
  api.mainModule('lib/client.js', 'client');
  api.mainModule('lib/server.js', 'server');

  // TypeScript ambient declaration file
  api.addAssets('index.d.ts', ['client', 'server']);

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
