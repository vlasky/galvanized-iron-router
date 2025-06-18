Galvanized Iron Router
==============================================================================

A complete client/server routing system for Meteor with layouts, middleware, and reactive templates.

**Version 2.0** - Iron Router made rust-resistant and long-lasting for Meteor 3.0+!

Galvanized Iron Router is a fork of the classic Iron Router package, giving it a new lease of life by making it fully compatible with Meteor 3.0 and beyond. Just as galvanizing iron makes it rust-resistant and longer lasting, this fork ensures Iron Router continues to work reliably with modern Meteor applications.

## The Iron Router Guide
Detailed explanations of router features can be found in the original [Iron Router Guide](http://iron-meteor.github.io/iron-router/).

## Installation

```shell
meteor add vlasky:galvanized-iron-router
```

## Compatibility

Galvanized Iron Router supports:
- **Meteor 2.0+** (stable)
- **Meteor 3.0+** (compatible with Fibers removal and Express 5)

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

## What's New in Version 2.0

Galvanized Iron Router v2.0 is a **major consolidation release** that combines all Iron packages into a single, comprehensive routing system:

### **Consolidated Packages**
All previously separate packages are now included:
- `iron:core` - Namespace and utilities
- `iron:url` - URL compilation and utilities
- `iron:middleware-stack` - Connect-style middleware
- `iron:dynamic-template` - Dynamic template rendering
- `iron:layout` - Layout system with yield regions
- `iron:location` - Reactive URL and browser state
- `iron:controller` - Route controllers with reactive state

### **Benefits**
- ✅ **Single installation**: Just `meteor add vlasky:galvanized-iron-router`
- ✅ **No dependency conflicts**: All components perfectly integrated
- ✅ **Simplified maintenance**: One package to update
- ✅ **Better performance**: Optimized load order and no inter-package overhead

### **Migration from v1.x**
**No changes needed!** Your existing code works unchanged. Simply update your packages:

```bash
meteor remove iron:core iron:layout iron:controller iron:location iron:middleware-stack iron:url iron:dynamic-template
meteor add vlasky:galvanized-iron-router@2.0.0
```

## Migrating to Meteor 3.0+

Iron Router is fully compatible with Meteor 3.0+. No code changes are required in your routes or controllers. The package automatically handles:

- Fibers removal (server-side routing continues to work seamlessly)
- Express 5 transition (body parsing is automatically updated)
- All existing route definitions, hooks, and controllers work unchanged

## Migrating from 0.9.4

Iron Router should be reasonably backwards compatible, but there are a few required changes that you need to know about:

### Hooks

`onRun` and `onBeforeAction` hooks now require you to call `this.next()`, and no longer take a `pause()` argument. So the default behaviour is reversed. For example, if you had:

```javascript
Router.onBeforeAction(function(pause) {
  if (! Meteor.userId()) {
    this.render('login');
    pause();
  }
});
```

You'll need to update it to

```javascript
Router.onBeforeAction(function() {
  if (! Meteor.userId()) {
    this.render('login');
  } else {
    this.next();
  }
});
```

This is to fit better with existing route middleware (e.g. connect) APIs.

### Controller Methods

`controller.setLayout()` is now `controller.layout()`. Usually called as `this.layout("fooTemplate")` inside a route action.

### Query Parameters
Query parameters now get their own object on `this.params`. To access the query object you can use `this.params.query`.

### Loading Hook

The `loading` hook now runs automatically on the client side if your route has a `waitOn`. As previously, you can set a global or per-route `loadingTemplate`.

If you want to setup subscriptions but not have an automatic loading hook, you can use the new `subscriptions` option, which still affects `.ready()`-ness, but doesn't force the `loading` hook.

### Hook and option inheritance

All hooks and options are now fully inherited from parent controllers and the router itself as you might expect. The order of precendence is now route; controller; parent controller; router.

### Route names

A route's name is now accessible at `route.getName()` (previously it was `route.name`). In particular, you'll need to write `Router.current().route.getName()`.

### Routes on client and server

It's not strictly required, but moving forward, Iron Router expects all routes to be declared on both client and server. This means that the client can route to the server and visa-versa.

### Catchall routes

Iron Router now uses [path-to-regexp](https://github.com/pillarjs/path-to-regexp), which means the syntax for catchall routes has changed a little -- it's now `'/(.*)'`.

### Template Lookup

If you don't explicitly set a template option on your route, and you don't
explicity render a template name, the router will try to automatically render a
template based on the name of the route. By default the router will look for the
class case name of the template.

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

* **Questions**: Please post to Stack Overflow and tag with `iron-router` : http://stackoverflow.com/questions/tagged/iron-router.

* **New Features**: If you'd like to work on a feature,
  start by creating a 'Feature Design: Title' issue. This will let people bat it
  around a bit before you send a full blown pull request. Also, you can create
  an issue to discuss a design even if you won't be working on it.

* **Bugs**: If you think you found a bug, please create a "reproduction." This is a small project that demonstrates the problem as concisely as possible. The project should be cloneable from Github. Any bug reports without a reproduction that don't have an obvious solution will be marked as "awaiting-reproduction" and closed after one week. Want more information on creating reproductions? Watch this video: https://www.eventedmind.com/feed/github-issues-and-reproductions.

###  Working Locally
This is useful if you're contributing code to iron-router.

  1. Set up a local packages folder
  2. Add the PACKAGE_DIRS environment variable to your .bashrc file
    - Example: `export PACKAGE_DIRS="/Users/cmather/code/packages"`
    - Screencast: https://www.eventedmind.com/posts/meteor-versioning-and-packages
  3. Clone the repository into your local packages directory
  4. Add iron-router just like any other meteor core package like this: `meteor
     add iron:router`

```bash
> git clone https://github.com/EventedMind/iron-router.git /Users/cmather/code/packages/iron:router
> cd my-project
> meteor add iron:router
```

## License
MIT
