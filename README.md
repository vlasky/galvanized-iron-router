Galvanized Iron Router
==============================================================================

[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://atmospherejs.com/vlasky/galvanized-iron-router)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Galvanized Iron Router is a fork of the classic Iron Router package, giving it a new lease of life by making it fully compatible with Meteor 3.0 and beyond. Just as galvanizing iron makes it rust-resistant and longer lasting, this fork ensures Iron Router continues to work reliably with modern Meteor applications.

It's a complete client/server routing system for Meteor with layouts, middleware, and reactive templates.

## Guide
The primary guide for this fork is in [Guide.md](Guide.md). The original Iron Router guide is still available as a legacy reference: [iron-meteor.github.io/iron-router](https://iron-meteor.github.io/iron-router/).

## Installation

```shell
meteor add vlasky:galvanized-iron-router
```

## Compatibility

Galvanized Iron Router supports all versions of Meteor from version 2.8.1 onwards. It has been tested on Meteor 2.8.1 and 3.4.

For Meteor 3.0+ projects, Galvanized Iron Router automatically adapts to:
- Async/await execution model (no Fibers dependency)
- Express 5 body parsing (when available)

## Migrating from iron:router

Migrating from `iron:router` to `vlasky:galvanized-iron-router` is simple:

```bash
meteor remove iron:router
meteor add vlasky:galvanized-iron-router
```

That's it! Your existing code will work without any changes. Galvanized Iron Router maintains 100% API compatibility with the original Iron Router.

## Examples
There are comprehensive examples in the [examples folder](examples) organized by feature:

- **[Router Examples](examples/router)** - Core routing functionality, data contexts, layouts, middleware
- **[Controller Examples](examples/controller)** - Route controllers, inheritance, wait lists
- **[Layout Examples](examples/layout)** - Dynamic layouts and yield regions
- **[Location Examples](examples/location)** - Reactive URL handling and browser state
- **[Template Examples](examples/dynamic-template)** - Dynamic template rendering
- **[Middleware Examples](examples/middleware)** - Connect-style middleware stack

## Quick Start
Create some routes in a client/server JavaScript file:

```javascript
Router.route('/', function () {
  this.render('MyTemplate');
});

Router.route('/items', function () {
  this.render('Items');
});

Router.route('/items/:_id', function () {
  var item = Items.findOne({_id: this.params._id});
  this.render('ShowItem', {data: item});
});

Router.route('/files/:filename', function () {
  this.response.end('hi from the server\n');
}, {where: 'server'});

Router.route('/restful', {where: 'server'})
  .get(function () {
    this.response.end('get request\n');
  })
  .post(function () {
    this.response.end('post request\n');
  });

```

## ES6 Module Support for Controllers

When using ES6 modules, controllers are no longer automatically available on the global scope. Galvanized Iron Router provides a controller registry so you don't need to pollute the global `window` object.

### Registering Controllers

Example:

```javascript
// client/controllers.js
import { DashboardController } from './management/dashboard.js';
import { StoreController } from './management/store.js';
import { UsersController } from './management/users.js';

Router.registerControllers([
  DashboardController,
  StoreController,
  UsersController
]);
```

Routes work exactly as before - controller names are extracted automatically from the class:

```javascript
Router.route('/dashboard', { controller: 'DashboardController' });
Router.route('/store/:id', { controller: 'StoreController' });
```

For anonymous controllers or custom names, use the two-argument form:

```javascript
Router.registerController('MyController', RouteController.extend({ ... }));
```

### How It Works

When resolving a controller by name, the router checks:
1. **Controller registry** - Controllers registered via `registerControllers()`
2. **Global namespace** - Falls back to `window[controllerName]` for backwards compatibility

This means existing code that assigns controllers to `window` continues to work unchanged.

## API Notes

### Hooks

`onRun` and `onBeforeAction` hooks require you to call `this.next()` to continue to the next handler. This follows the connect middleware convention.

```javascript
Router.onBeforeAction(function() {
  if (! Meteor.userId()) {
    this.render('login');
  } else {
    this.next();
  }
});
```

### Middleware handler naming

Handler names are used for lookups like `findByName`, `insertBefore`, and `insertAfter`.

- **Explicit names** (`{ name: 'auth' }`) must be unique and are the only safe way to target a handler by name.
- **Implicit names** (derived from function names or paths) are allowed to collide and should not be relied on for name-based insertion.

If you plan to reference a handler later, always provide an explicit `name`.

### Controller Methods

Use `this.layout("fooTemplate")` inside a route action to set the layout.

### Query Parameters

Query parameters are available on `this.params.query`.

### Loading Hook

The `loading` hook runs automatically on the client side if your route has a `waitOn`. You can set a global or per-route `loadingTemplate`.

If you want to setup subscriptions but not have an automatic loading hook, use the `subscriptions` option, which still affects `.ready()`-ness, but doesn't force the `loading` hook.

### Hook and option inheritance

Hooks and options are inherited from parent controllers and the router. The order of precedence is: route; controller; parent controller; router.

Option lookup treats `undefined` as "not set" and will fall through to lower-precedence sources. If you need to explicitly clear an option, use `null`.

### Route names

A route's name is accessible via `route.getName()`. For example: `Router.current().route.getName()`.

### Routes on client and server

It's not strictly required, but Iron Router works best when routes are declared on both client and server. This allows the client to route to the server and vice-versa.

### Catchall routes

Iron Router uses [path-to-regexp](https://github.com/pillarjs/path-to-regexp). The syntax for catchall routes is `'/(.*)'`.

### Template Lookup

If you don't explicitly set a template option on your route, and you don't
explicitly render a template name, the router will try to automatically render a
template based on the name of the route. By default the router will look for the
PascalCase name of the template.

For example, if you have a route defined like this:

```javascript
Router.route('/items/:_id', {name: 'items.show'});
```

The router will by default look for a template named `ItemsShow` with capital
letters for each word and punctuation removed. If you would like to customize
this behavior you can set your own converter function. For example, let's say
you don't want any conversion. You can set the converter function like this:

```javascript
Router.setTemplateNameConverter(function (str) { return str; });
```

## Contributing
Contributors are very welcome. There are many things you can help with,
including finding and fixing bugs, creating examples for the examples folder,
contributing to improved design or adding features. Some guidelines below:

* **Questions**: Please post to Stack Overflow and tag with `iron-router` : https://stackoverflow.com/questions/tagged/iron-router.

* **New Features**: If you'd like to work on a feature,
  start by creating a 'Feature Design: Title' issue. This will let people bat it
  around a bit before you send a full blown pull request. Also, you can create
  an issue to discuss a design even if you won't be working on it.

* **Bugs**: If you think you found a bug, please create a "reproduction." This is a small project that demonstrates the problem as concisely as possible. The project should be cloneable from GitHub. Any bug reports without a reproduction that don't have an obvious solution will be marked as "awaiting-reproduction" and closed after one week.

### Working Locally
This is useful if you're contributing code to Galvanized Iron Router.

  1. Set up a local packages folder
  2. Add the PACKAGE_DIRS environment variable to your .bashrc file
    - Example: `export PACKAGE_DIRS="/home/user/code/packages"`
  3. Clone the repository into your local packages directory
  4. Add the package to your Meteor project

```bash
git clone https://github.com/vlasky/galvanized-iron-router.git /home/user/code/packages/galvanized-iron-router
cd my-project
meteor add vlasky:galvanized-iron-router
```

## License
MIT
