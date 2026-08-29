v2.3.0 / unreleased
==================
* The router no longer uses jQuery: delegated link clicks, template insertion, hash scrolling, tests and the executable examples now use native DOM APIs. The `jquery` dependency is now *weak*, so this package no longer pulls jQuery into your app. Blaze 3.1+ applications can go fully jQuery-free
* **Migration note:** on Blaze 2.x and 3.0.x (all Meteor 2 apps, and Meteor 3 apps not yet on Blaze 3.1), Blaze itself still requires jQuery and fails at client startup with `Error: jQuery not found` when nothing supplies it. Almost all apps already list `jquery` in `.meteor/packages` (Meteor's own upgraders and app skeletons add it); if yours relied on this package to supply jQuery, run `meteor add jquery`. You control the jQuery version by installing it from npm (`meteor npm install jquery@<version>`); the Meteor `jquery` package detects and uses it. On Meteor 2, a development-mode server startup warning now detects jQuery missing from the client bundle and prints this remedy
* Behaviour notes for the jQuery-to-native conversion: the click listener binds when `Location.start()` runs (no longer deferred to `Meteor.startup`); `Location.onClick` handlers receive a native `MouseEvent` (no jQuery event methods such as `isDefaultPrevented()`); programmatic `$(link).trigger('click')` no longer reaches the router (native `link.click()` does); when nested elements both match `linkSelector`, the handler fires once for the innermost match instead of once per matching ancestor
* `linkSelector` values are now validated when set (`Location.configure`) and at `Location.start()`: an invalid CSS selector (including jQuery-only extensions like `:visible`) throws a descriptive error immediately instead of erroring on every document click
* `insert({el: ...})` continues to accept an array-like wrapper of elements (e.g. a jQuery collection) in addition to a CSS selector string or an element; an empty wrapper still raises the descriptive "No element to insert layout into" error
* `_scrollToHash` now resolves the URL fragment as a decoded element id, so ids containing spaces or encoded characters scroll correctly, and malformed fragments are ignored

v2.2.1 / 2026-07-11
==================
* `Iron.utils.extend` and `Iron.utils.inherits` no longer copy statics with `EJSON.clone`, which silently mangled any non-EJSON object static: a `RegExp`, `Map`, `Set` or prototyped instance hung off a controller became `{}` on the child. Plain objects and arrays are still shallow-copied (so top-level child mutations don't write through to the parent); everything else now passes by reference with its type intact
* `Url.fromQueryString` skips query pairs whose key fails to decode (e.g. `?%ZZ=1`) instead of creating a property literally named `"undefined"`
* The parent-view walk caps in `DynamicTemplate.getDataContext` (30) and `getInclusionArguments` (15) now emit a console warning when actually reached, instead of silently returning an absent context in pathologically deep view trees
* Add a regression test pinning that a data context literally shaped `{value: X}` reaches templates intact: published Blaze 3.x wraps *every* data context as `{value: data}` (`Blaze.getData` itself reads `dataVar.get()?.value`), so Iron's single unwrap mirrors Blaze's own contract and a genuine `{value: X}` context arrives double-wrapped and survives. The test will surface any future Blaze change to this behaviour
* Fix the Blaze 2 detection that was supposed to disable the `{value}` unwrapping on Meteor 2: it sniffed the nonexistent `Package.blaze.version`, so it always answered "Blaze 3" and a genuine `{value: X}` data context was corrupted on Blaze 2 (caught by the new pinning test on the Meteor 2 leg). Detection now keys off `Meteor.isFibersDisabled`
* Document the 2.2.0 `extend()` custom-constructor semantics change in the README API notes (previously only in this changelog)

v2.2.0 / 2026-07-05
==================
* Verified against Meteor 3.5 (released 2026-07-01, Node 24), Meteor 3.4.1 (Node 22) and Meteor 2.8.1 (Node 14, fibers, npm `body-parser` branch): full test suite passes on all three
* Verified with Meteor 3.5's Rspack bundler integration (`rspack@1.1.0`, the default in new 3.5 apps): dev and production builds succeed, client routing (layout/yield/data contexts/`Router.go`) and server REST routes (JSON body parsing, async actions) all work. Rspack bundles app code only; Atmosphere packages such as this one continue to be built by the classic Meteor bundler
* Server REST tests now obtain `fetch` from the core `fetch` package (test-only dependency) so they run on Meteor 2, whose Node 14 has no global fetch
* Fix server body parsers never being installed since the v2.1.0 ES6 module conversion: `this.request.body` was always `undefined` for server REST routes (`configureBodyParsers` was calling a do-nothing static stub). Server `Router.start()` is now also idempotent
* Support async (promise-returning) route handlers, the common case on Meteor 3
  * An async action that throws now returns a 500 instead of hanging the request as an unhandled promise rejection (fatal on modern Node)
  * `await ...; this.next()` works: dispatch bookkeeping is deferred until in-flight handlers settle
  * `onAfterAction` hooks (client and server) run after an async action completes, not after its first `await`
  * A handler that calls `next()` and rejects afterwards can no longer complete the stack twice (the late rejection is logged)
* Fix multi-level `extend()` chains producing uninitialized controllers: `ApplicationController = RouteController.extend({...}); PostController = ApplicationController.extend({...})` left instances without `options`/`params`/`_layout`. `Iron.utils.extend` now produces a genuine `class extends Parent` at every level
  * Semantics note: a custom `constructor` prop now always runs *after* the parent chain (previously, with a plain-function parent, it *replaced* the parent constructor). It must not call `__super__.constructor` itself
* Fix hooks, event maps and helpers silently lost on native class chains: `class Admin extends Auth extends RouteController` skipped `Auth`'s `onBeforeAction`/`waitOn`/`events()` entirely; `Controller.helpers()` on a native subclass leaked helpers to the parent and every sibling
* Harden URL parsing
  * `GET /route?__proto__[]=x` (or any query key naming an `Object.prototype` member) crashed dispatch; query keys are now assigned prototype-safely
  * Query values containing `=` (e.g. base64 padding) are no longer truncated
  * `+` is now literal in path segments (RFC 3986); plus-as-space applies to query strings only
* Fix routes named after Array members (`/push`, `/map`, `/length`, ...) corrupting the router; named handlers and routes now live in prototype-less side maps, with a new `Router.findRouteByName(name)` lookup (the legacy `Router.routes.someName` alias remains for non-colliding names)
* Make the controller registry minifier-safe: only an *own* `static _name` keys a registration, overwrites log a warning, and the docs now recommend the object-map `registerControllers({...})` form whose keys survive minification
* Fix client `Router.stop()` being a permanent no-op (`start()` never set `_isStarted`); repeated `start()` calls no longer stack duplicate location autoruns
* Fix duplicate *explicitly named* middleware being silently allowed (`stack.push(fn, {name: 'auth'})` twice now throws, as v2.1.0 intended)
* Fix `init()` being called twice on every `RouteController` instantiation (inherited from upstream iron:router)
  * Both the `Controller` and `RouteController` constructors called `this.init(options)`, so user-defined `init` hooks ran twice and on the client the controller's `WaitList` and reactive state dictionary were allocated twice, with the first pair discarded
  * The base constructor now skips the call when a subclass declares (via a `_deferInit` prototype getter) that it calls `init()` itself once construction is complete, so `init()` runs exactly once, on a fully constructed controller
* Fix server HEAD responses calling `res.end()` twice in the no-client-routes branch
* Add regression tests throughout: end-to-end server REST tests (JSON body parsing, async actions, async 500s), multi-level inheritance instance state, native-class hook/event collection, prototype-safe query parsing, Array-member route names, and init-once semantics
* Housekeeping: declare the `reactive-var` dependency on the server too (previously satisfied only via Blaze's transitive dependency), remove the long-dead `lib/url/old_compiler.js`, give two test files descriptive names, and bring `lib/url/compiler.js` under type checking
* Deliver TypeScript definitions via `zodern:types` (the mechanism Meteor 3's own docs recommend): `package-types.json` now points at `index.d.ts`, replacing the ignored `types:` describe key and the `addAssets` workaround that also served the declaration file to browsers as a public static asset
* Overhaul `index.d.ts` to match the real runtime API
  * The declaration file now compiles cleanly under `skipLibCheck: false` (previously 15 errors: duplicate `Handler` exports, circular global self-references, a `Route.options` method/property collision, and `typeof globalThis.X` lookups that never resolved)
  * `this.params` is now typed as what it really is: an array of positional match groups carrying the named params, plus `query` and `hash` properties (`ControllerParams`); same for `Route#params`, `Url#params` and `Handler#params`
  * The exported `Router` is typed as the callable router instance; class-level configuration (`hooks`, `plugins`, `bodyParser`, `HOOK_TYPES`) is typed on `Iron.Router` where it actually lives
  * Removed phantom APIs: `Iron.Class` (real: `Iron.utils.extend`/`inherits`), `Route#options(fn)` (there is no OPTIONS verb), a `Blaze.TemplateInstance#controller()` augmentation nothing implements, and `Router._controllerRegistry` (real: `_controllers`)
  * Added missing APIs: `Iron.Controller`, `Iron.Route`, `Iron.Handler`, `DEFAULT_REGION`, `MiddlewareStack#onServerDispatch`, and the path-less `stack.push(fn, options)` overloads
  * `Location.onGo`/`onPopState` callbacks are now typed with the state as `this` (they receive no arguments); client-only entry exports (`Location`, `State`, `WaitList`, hash-url helpers) are marked as such
* `Router.onBeforeAction()` and the other hook registration methods now return the router (chainable), as `addHook` already did
* Fix Blaze 3 data-context resolution in dynamic templates (all with regression tests)
  * `getDataContext()` now returns the *nearest* acceptable data context, matching Blaze's own scoping; previously a primitive context farther up the view tree beat a nearer object context
  * A bare `{{> yield}}` inside a template that was itself included with a `region=` argument (`{{> Widget region="sidebar"}}`) no longer adopts that argument and renders into the wrong region: the inclusion-argument walk stops at template boundaries
  * A string data context is no longer mistaken for a positional region argument; the `Blaze.getData` fallback applies only to block helpers like `{{#contentFor "footer"}}`
  * Helper arguments are read reactively again (upstream behaviour): `{{#Layout template=reactiveTmpl data=reactiveData}}` now updates when the bindings change instead of freezing their first values
  * `{{> DynamicTemplate}}` resolves `template=`/`data=` from the actual inclusion arguments first; a helper or data context property named `template` or `data` can no longer hijack them (previously an absent `data=` argument was resolved via `lookup('data')`, replacing the inherited parent context)
  * An object data context mixing reserved keys with ordinary ones (e.g. `{template: 'invoice', title: ...}`) is now treated as real data rather than inclusion arguments
  * `{ value: X }` unwrapping only runs on Blaze 3, so a legitimate `{value: ...}` data context is untouched on Blaze 2
  * Region hooks (`onRegionCreated`/`onRegionRendered`/`onRegionDestroyed`) now receive the region name as their first argument as documented (previously always `undefined`)
  * A reactive `region=` on `contentFor` clears the previously populated region when it changes, instead of leaving the content rendered in both regions
  * Extra keyword arguments on Iron's own helpers (`{{> DynamicTemplate template="X" extra=y}}`) remain control arguments and don't leak into the inherited data context; the mixed-key-is-data rule applies only to user inclusions

v2.1.3 / 2026-06-23
==================
* Fix `this.params.query` returning `{}` (query string parameters not parsed) (GH #6)
  * `MiddlewareStack.dispatch` was computing `handler.params()` from the url *after* `Url.normalize` had stripped the query string, producing an empty query object that was then merged over the controller's correctly-parsed params
  * Dispatch now parses params from the raw url (with its query string and hash) while still normalizing for path matching
  * Regression introduced in the 2.1.0 ES6 refactor; query params worked in 2.0.3
* Add regression test ensuring dispatched query params, array query params, and the hash fragment survive normalization

v2.1.2 / 2026-02-18
==================
* Fix production route registration failure: `Handler with name 'r' already exists`
  * Clear the callable route function name in `Route` so handler naming falls back to path-derived names
  * Prevent minified implicit function names from colliding across routes in production bundles
* Add regression test ensuring callable route names remain blank and route names derive from path

v2.1.1 / 2026-02-09
==================
* `registerControllers()` now accepts an object map in addition to arrays
  * `Router.registerControllers({ DashboardController, StoreController })` registers by key name
  * Useful for controllers created via `RouteController.extend()` where `Function.name` may not be configurable
* `Iron.utils.extend` now sets `_name` property on constructors when `props.name` is provided
  * Also attempts to set `Function.name` via `Object.defineProperty` as a best-effort
* `registerController()` prefers `controller._name` over `controller.name` for registry key lookup
* TypeScript definitions significantly expanded:
  * Added `RouteControllerExtendProps` interface for strongly-typed `RouteController.extend()` calls
  * Added `AsyncHookFunction` type for async action methods
  * Added full declarations for `Handler`, `Url`, `State`, and `LocationAPI` classes/interfaces
  * Broadened module exports to include `Route`, `Controller`, `Layout`, `DynamicTemplate`, `MiddlewareStack`, `WaitList`, `Handler`, `Url`, `Location`, `State`, `RC`, and hash URL utilities
  * `render()` template parameter now optional; `RenderOptions.data` and `route()` callback typed with `RouteController` context
  * `RouteController` now has an index signature for arbitrary custom properties
  * Declared global `RC` alias for `RouteController`
* Package metadata now declares `types: 'index.d.ts'` and ships the declaration file as an asset
* Updated documentation for object-map controller registration in README.md and Guide.md

v2.1.0 / 2026-02-02 (unreleased)
==================
* ES6 refactor and Blaze 3.0 compatibility improvements
* Fix data context lookup with class-field shadowing on controllers
* Allow duplicate implicit middleware names; explicit names remain unique
* Add regression tests for middleware naming and controller data lookup
* Added controller registry for ES6 module support
  * `Router.registerControllers([...])` - register an array of controllers
  * `Router.registerController(name, Controller)` - register with explicit name
  * Eliminates the need to attach controllers to `window` when using ES6 modules
* Tested on Meteor 2.8.1 and 3.4

v2.0.3 / 2025-9-13
==================
* Meteor package tracker now declared for use on server side as well.

v2.0.2 / 2025-8-01
==================
* Meteor package random now declared for use on server side as well.

v2.0.1 / 2025-6-25
==================
  * Fixes route data contexts not flowing to rendered templates in Meteor 3.0
  * RouteController.prototype.render() now explicitly passes data context to templates due to suspected breaking change in Blaze 3.0.0 that may have affected implicit data context inheritance through view hierarchies

v2.0.0 / 2025-6-18
==================
  * Iron Router made rust-resistant for Meteor 3.0+
  * Complete rewrite for Meteor 3.0 compatibility
  * Consolidated multiple Iron packages into one
  * Added support for async/await patterns
  * Removed Fibers dependencies

v1.1.2 / 2017-2-12
==================
  * Bump Iron:Url version

v1.1.0 / 2017-1-14
==================
  * Add 'noRoutesTemplate' config option
  * Clarify default page messaging

v1.0.11 / 2015-10-09
==================
  * Fix Iron-Layout for Meteor 1.2

1.0.10 / 2015-10-6
==================
  * compatibility fix for Meteor 1.2

1.0.6 / 2014-12-18
==================
  * roll back a change that resulted in re-rendering templates on every route
    change. The effect of this change is that sometimes controller helpers will
    not rerun even if the route has changed. But this is less of a problem than
    large parts of the page re-rendering.

1.0.5 / 2014-12-17
==================
  * Don't use. See note in 1.0.6

1.0.4 / 2014-12-17
==================
  * Upgrade to 1.0.6. See note in 1.0.6.
  * auto detect url scheme so you can cut and paste IE8 urls to modern browsers for example
  * correctly handle + in uri components
  * correctly handle spaces in GET queries
  * remove trailing slash between path and hash frag
  * use #! instead of # hash frag to support spiderable
  * make sure prev controller stopped before setting params
  * remove Object.keys issue causing problems in IE8
  * only instantiate controller for the correct environment
  * change "frag" to "hash" in guide example of linkTo
  * don't call out to server route if history.state.initial is true
  * implement ready() and wait() on server
  * config bodyParser which is overridable
  * mention template lookup semantics in readme...
  * Merge pull request #1120 from NestedData/devel
  * Merge pull request #1123 from zimme/name
  * Merge pull request #1124 from dburles/patch-1
  * update tom's isHandled logic to use thisArg instead of params...
  * added one semicolon
  * Add name to package.js
  * Added note about getParams
  * Merge pull request #1100 from lirbank/patch-1
  * Merge pull request #1078 from lb-/patch-1
  * Update Guide.md
  * Make static files work again
  * Minor typo in guide.md

1.0.0 / 2014-10-28
==================
  * Major refactor and cleanup
  * See the README.md for a migration guide from previous versions
  * Mostly backward compatible but a few breaking changes

v0.9.2 / 2014-08-27
==================
  * Bump iron:dynamic-template and iron:layout dependencies for Meteor 0.9.1 release
  * Fix #742 - https://github.com/EventedMind/iron-router/commit/69222246194fb630996fdb988335fed208e4caf4#commitcomment-7468636
  * Added another failing test case. For #742
  * Update README.md
  * fix waitlist onInvalidate logic
  * fix package.js to use METEOR vs METEOR-CORE in versionsFrom

v0.9.1 / 2014-08-18
=================
  * Fix waitlist to ensure ready() is correct before next flush
  * Throw error on infinite invalidation loops for waitlist
  * Fix multiple data issues
  * Make onRun only run once

v0.9.0 / 2014-08-12
==================
  * update for new package system
  * throw error for cmather:iron-router and use iron:router instead
  * remove deprecate method from utils since we have it in core

v0.8.2 / 2014-07-29
==================
  * fix subscribe(...).wait() bug

v0.8.0 / 2014-07-29
==================
  * add new waitlist from refactor
  * remove bad tests
  * change version to 0.8.0
  * add specific iron-layout version dependency in smart.json
  * Merge branch 'bug/layout-rendering' into devel
  * fix layout rendering bug with issue #724
  * add version in package.js
  * track current rendering transaction...
  * When controller stops call endRendering to stop rendering transaction.
  * add contributors to history file
  * remove build status for now will bring back later
  * update history
  * Merge branch 'devel' into feature/iron-layout
  * add history entry and fix package dep on iron-layout
  * Merge pull request #712 from aramk/patch-1
  * Used new method name in sample code.
  * layout.endRendering() returns an array of keys now
  * fix smart.json file.
  * fix clearUnusedRegions bug and add waitOn test example
  * wip - fix integrate iron-layout...
  * Finish iron-layout integration.
  * Make basic example a little more realistic.
  * Make sure we clear unused regions if the before hook pauses.
  * Added test and fix for #652
  * fix: ie9 omits leading slash in pathname on click handler
  * Added test to prove I was wrong in #689
  * Added test case and fixed #676
  * Don’t call unnecessary stop() in client router when browsing away.
  * Update route_controller.js
  * Add semicolon
  * Update DOCS.md
  * Update README.md
  * Fix test to use newController vs legacy getController.
  * Supress warnings during testing.
  * Router.configure({supressWarnings: true}) prevents warnings.
  * Correcting outdated examples in docs.md
  * Get rid of `this.stop()` !!
  * Style cleanup in server router.
  * Fix findController and tests for Route.
  * Fix findController method.
  * Merge branch 'patch-1' of github.com:dandv/iron-router into dandv-patch-1
  * Fix #562 - s/before/onBeforeAction/, same for after
  * Update .gitignore to ignore smart.lock
  * Delete smart.lock; Fixes #608
  * Sorry I forgot I'm having commit access. oops.
  * Dummy Commit
  * Clean up location file whitespace.
  * Refactor and clean up getController method on Route.
  * Merge branch 'travis-tests' of github.com:mizzao/iron-router into mizzao-travis-tests
  * Merge branch 'dev' of github.com:EventedMind/iron-router into dev
  * Bump blaze-layout version and minor pr/607 adjustments.
  * Set layout before each recomputed action; closes #600
  * Fix up route error messages and url func.
  * Remove erroneous executable permssion on js files.
  * Bump blaze-layout version and minor pr/607 adjustments.
  * Set layout before each recomputed action; closes #600
  * Fix up route error messages and url func.
  * Merge pull request #590 from dandv/patch-1
  * Remove erroneous executable permssion on js files.
  * enable automated testing on travis-ci.org
  * Update History.md
  * Update README.md
  * Mention that Router.current() is reactive
  * Integrate iron-layout for new Blaze.View work
  * Only use one main computation in _run instead of one for each thing
  * Fix clearUnusedRegion bug
  * Fix ie9 omits leading slash in pathname on click handler
  * Dont call unnecessary stop() in client router when browsing away
  * Examples corrections

## v0.7.1
* Fix dataNotFoundHook
* Bump blaze-layout to 0.2.4
  * Better error message for {{yield}} vs {{> yield}}
  * Make parent data context available inside Layout when using Layout manually
* Remove Handlebars symbol from helpers.js
* Fix client helpers processArgs bug
* Don't call the data() function until controller is ready

## v0.7.0
* Blaze rendering with the [blaze-layout](https://github.com/eventedmind/blaze-layout) package.
  * Layouts are only taken off the DOM (re-rendered) if the layout changes.
  * Templates are only taken off the DOM (re-rendered) if the template changes.
  * Data contexts change independently from rendering.
  * {{yield}} is now {{> yield}} and {{yield 'footer'}} is now {{> yield region='footer'}}
  * {{#contentFor region='footer'}}footer content goes here{{/contentFor}} is supported again!
  * Router supports a uiManager api that can be used to plug in other ui managers (in addition to blaze-layout)
* RouteController API cleanup
  * Hook name changes (legacy supported until 1.0)
    * before -> onBeforeAction
    * after -> onAfterAction
    * load -> onRun
    * unload -> onStop
  * No more getData and setData methods on RouteController instances. Just use `this.data()` to call the controller's wrapped data function.
  * run method changes
    * Changed run to _run to indicate privacy
    * A RouteController is in a running state or a stopped state. You cannot run a controller that is already running.
    * You cannot call `stop()` inside of a run. Use `pause()` for hooks now instead. see below.
    * Order of operations:
      1. Clear the waitlist
      2. Set the layout
      3. Run the onRun hooks in a computation
      4. Run the waitOn function in a computation, populating the waitlist
      5. Set the global data context using the controller's wrapped data function
      6. Run the action in a computation in this order: onBeforeAction, action, onAfterAction
  * Hook api changes
    * You can no longer call `this.stop()` in a hook. Use `pause()` instead which is the first parameter passed to the hook function. This stops downstream hooks from running. For example the loading hook uses pause() to stop the action function from rendering the main template.
    * No hooks are included in your controllers by default. If you want to add them you can do it like this:
      * `Router.onBeforeAction('loading')`
      * `Router.onBeforeAction('dataNotFound')`
    * Package authors can include their own hooks in the lookup chain by adding them to the `Router.hooks` namespace. Then users can add them by name like this: `Router.onBeforeAction('customhook');`
    * See lib/client/hooks.js for example.
    * Hooks are now called in a different order by popular demand:
      1. controller options
      2. controller prototype
      3. controller object
      4. route option hooks
      5. router global

* Helpers cleanup
  * `{{link}}` helper is no longer included by default. These types of helpers can be implemented in separate packages.
  * `{{renderRouter}}` is gone for now.
  * `{{pathFor}}` and `{{urlFor}}` still work with some api changes:
    * {{pathFor 'routeName' params=this query="key=value&key2=value2" hash="somehash" anotherparam="anothervalue"}}
    * same for {{urlFor}}

* IronLocation changes
  * The router now sets up the link handler for much more consistency between `Router.go` and clicks on links.
  * The location URL changes in between stopping the old route and starting the new one, so `onStop` and `onRun` behave as you'd expect.
  * `location` is now an option to configure so you can use a custom location manager (apart from IronLocation).

## v0.6.2
* Bug fix: couldn't go back after page reload. Thanks @apendua!
* Added ability to customize IronLocation link selector. Thanks @nathan-muir
* Fixed a problem with child hooks running multiple times. Thanks @jagi!
* Fixed a problem with stopping the process when redirecting
* Fixed issues with optional paths, thanks @mitar
* Fixed problem on Android 2.3



## v0.6.1
* Bug fix: notFound template rendered with layout
* Bug fix: loading and notFound render yeilds again
* Bug fix: IE8 issue with 'class' property name on link handlebars helper
* Bug fix: Global hook regression
* Readme fixes

## v0.6.0
* **WARNING:** Breaking Changes
  * The `layout` option is now called `layoutTemplate`
  * The `renderTemplates` option is now called `yieldTemplates`
  * RouteController `onBefore..` and `onAfter..` methods removed (now just use
    `before` and `after`)
  * `Router.current()` now returns a `RouteController` instance
  * data option now applies only to the Route or RouteController, not to the render method
  * pathFor and urlFor semantics have changed slightly (hash and query params can now be the key value pairs of the Handlebars expression)
    1. `{{pathFor contextObject queryKey=queryValue hash=anchorTag}}`
    or
    2. ```
        {{#with contextObject}}
          {{pathFor queryKey=queryValue hash=anchorTag}}
        {{/with}}
       ```

* Route and RouteController level layouts
* Support for url hash fragments
* Better support for query string parameters
* PageManager class for handling layout and template rendering and storing a global data context
  * Layouts and templates now only re-render if the actual template has changed (allows for maintaining a layout/template across routes with no flicker)
  * Data context is set/get globally on/from the Router
  * See the lib/client/page_controller.js file for details
* No more silly RouteContext; all this stuff is in the RouteController instance
* Partial support for IE8-9. Pages make a server request if pushState is not supported by the browser. This is a performance penalty, but it works
* Cleaned up API signatures and passing of options from Router->Route->RouteController
* Fix onclick handler and moved into lib/client/location.js
* Client and Server Router now inherit from IronRouter
* Client and Server RouteController now inherit from IronRouterController
* Removed unnecessary global symbol exports (still accessible through Package['iron-router'] namespace)
* Global `notFoundTemplate` will render if a route is not found.
* Added `load` hook which fires exactly once per route load (and respects hot-code-reload!)
* Added `Router.before()` and friends which let you add global hooks with a bit more subtlety.

## v0.5.4
