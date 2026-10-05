String.prototype.compact = function () {
  return this.trim().replace(/\s/g, '').replace(/\n/g, '');
};

var ReactiveVar = function (value) {
  this._value = value;
  this._dep = new Tracker.Dependency;
};

ReactiveVar.prototype.get = function () {
  this._dep.depend();
  return this._value;
};

ReactiveVar.prototype.set = function (value) {
  if (value !== this._value) {
    this._value = value;
    this._dep.changed();
  }
};

ReactiveVar.prototype.clear = function () {
  this._value = null;
  this._dep = new Tracker.Dependency;
};

// a reactive template variable we can use
var reactiveTemplate = new ReactiveVar;

// a reactive data variable we can use
var reactiveData = new ReactiveVar;

var withDiv = function (callback) {
  var el = document.createElement('div');
  document.body.appendChild(el);
  try {
    callback(el);
  } finally {
    document.body.removeChild(el);
  }
};

var withRenderedTemplate = function (template, callback) {
  withDiv(function (el) {
    template = typeof template === 'string' ? Template[template] : template;
    Blaze.render(template, el);
    Tracker.flush();
    callback(el);
  });
};

Tinytest.add('Controller - inheritance', function (test) {
  var calls = [];

  Parent = Iron.Controller.extend({
    parentProp: true
  });

  test.instanceOf(Parent.extend, Function);
  test.equal(Parent.__super__, Iron.Controller.prototype);
  test.isTrue(Parent.prototype.parentProp);

  Child = Parent.extend({
    childProp: true
  });

  test.instanceOf(Child.extend, Function);
  test.equal(Child.__super__, Parent.prototype);
  test.isTrue(Child.prototype.childProp);

  var c = new Child;
  test.isTrue(c.childProp);
  test.isTrue(c.parentProp);

  // test constructor overloading
  var calls = [];
  ChildB = Parent.extend({
    constructor: function () {
      calls.push('ChildB');
    }
  });

  var c = new ChildB;
  test.equal(calls.length, 1);
});

Template.ControllerChangeTest.helpers({
  id: function () {
    var c = Iron.controller();
    return c && c.options.id;
  }
});

Tinytest.add('Controller - change layout controllers', function (test) {
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    // start off with no controller
    layout.render('ControllerChangeTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Controller-");

    // change the controller on the layout
    var c1 = new Iron.Controller({layout: layout, id: 1});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Controller-1");

    // now swap out the controller
    var c2 = new Iron.Controller({layout: layout, id: 2});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Controller-2");
  });
});

Template.ControllerTest.helpers({
  id: function () {
    var c = Iron.controller();
    return c && c.options.id;
  }
});

Template.ControllerChild.helpers({
  id: function () {
    var c = Iron.controller();
    return c && c.options.id;
  }
});

Tinytest.add('Controller - Iron.controller() lookup in helpers', function (test) {
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    // start off with no controller
    layout.render('ControllerTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Parent-Child-");

    // set the controller on the layout
    var c1 = new Iron.Controller({layout: layout, id: 1});
    Tracker.flush();

    // Iron.controller() should work for child templates and parent
    // templates
    test.equal(el.innerHTML.compact(), "Parent-1Child-1");
  });
});

var lastEvent = null;

Template.ControllerEventHandler.events({
  'click': function () {
    var c = Iron.controller();
    lastEvent = {id: c && c.options.id};
  }
});

Tinytest.add('Controller - Iron.controller() lookup in event handlers', function (test) {
  var layout = new Iron.Layout({template: 'ControllerEventHandler'});
  withRenderedTemplate(layout.create(), function (el) {
    test.equal(el.innerHTML.compact(), "<div>TriggerClick</div>");

    var c1 = new Iron.Controller({layout: layout, id: 1});
    Tracker.flush();

    el.querySelector('div').click();
    test.isTrue(lastEvent, 'last event is set');
    test.equal(lastEvent.id, 1);
  });
});

Template.ReactiveStateTest.helpers({
  postId: function () {
    var c = Iron.controller();
    return c && c.state.get('postId');
  }
});

Tinytest.add('Controller - reactive state variables', function (test) {
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    layout.render('ReactiveStateTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "");

    var c = new Iron.Controller({layout: layout});
    c.state.set('postId', 1);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "1");

    var c = new Iron.Controller({layout: layout});
    c.state.set('postId', 2);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "2");
  });
});

Tinytest.add('Controller - init runs exactly once', function (test) {
  var count = 0;
  var C = Iron.Controller.extend({
    init: function (options) {
      count++;
      C.__super__.init.apply(this, arguments);
    }
  });
  new C;
  test.equal(count, 1, 'init should run once for direct Controller subclasses');
});

Tinytest.add('Controller - event maps from intermediate native class ancestors', function (test) {
  class EventsBase extends Iron.Controller {}
  EventsBase.events({'click .base': function () {}});

  class EventsChild extends EventsBase {}
  EventsChild.events({'click .child': function () {}});

  var map = Iron.Controller._collectEventMaps.call(EventsChild);
  test.isTrue(!!map['click .base'], 'event from intermediate native ancestor collected');
  test.isTrue(!!map['click .child'], 'own event collected');
});

Tinytest.add('Controller - helpers do not leak across native subclasses', function (test) {
  class HelperA extends Iron.Controller {}
  class HelperB extends Iron.Controller {}

  HelperA.helpers({onlyA: function () { return 'a'; }});
  HelperB.helpers({onlyB: function () { return 'b'; }});

  test.isFalse(Object.prototype.hasOwnProperty.call(Iron.Controller._helpers, 'onlyA'),
    'base Controller helpers must not be polluted by a subclass');
  test.isFalse('onlyA' in HelperB._helpers, 'sibling subclasses must not see each other\'s helpers');
  test.isTrue(!!HelperA._helpers.onlyA, 'subclass keeps its own helper');
});

// iron-router #1293: every controller change used to invalidate every template
// and helper lookup made under the layout, so the layout content was torn down
// and rebuilt on each route change even when nothing could resolve differently.
var noRerenderCounts = {parent: 0, child: 0};
Template.ControllerNoRerenderTest.onCreated(function () { noRerenderCounts.parent++; });
Template.ControllerNoRerenderChild.onCreated(function () { noRerenderCounts.child++; });

Tinytest.add('Controller - changing controllers without helpers does not re-render the layout content', function (test) {
  noRerenderCounts = {parent: 0, child: 0};
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    layout.render('ControllerNoRerenderTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Static-Child");

    new Iron.Controller({layout: layout, id: 1});
    Tracker.flush();
    new Iron.Controller({layout: layout, id: 2});
    Tracker.flush();

    test.equal(el.innerHTML.compact(), "Static-Child");
    test.equal(noRerenderCounts.parent, 1, 'parent template created once');
    test.equal(noRerenderCounts.child, 1, 'included child template created once');
  });
});

Tinytest.add('Controller - helper lookups follow a controller change', function (test) {
  class SwapA extends Iron.Controller {}
  class SwapB extends Iron.Controller {}
  SwapA.helpers({
    who: function () { return 'a'; },
    hostId: function () { return this.options.id; }
  });
  SwapB.helpers({who: function () { return 'b'; }});

  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    layout.render('ControllerHelperSwapTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Who--");

    // no helpers -> helpers
    new SwapA({layout: layout, id: 1});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Who-a-1");

    // same controller class, new instance: helpers must be bound to it
    new SwapA({layout: layout, id: 2});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Who-a-2");

    // helpers -> other helpers
    new SwapB({layout: layout, id: 3});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Who-b-");

    // helpers -> no helpers
    new Iron.Controller({layout: layout, id: 4});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Who--");
  });
});

// Helper lookups depend on the lookup host per helper name, so a controller
// that declares helpers only invalidates the lookups of those names.
Tinytest.add('Controller - controllers with unrelated helpers do not re-render the layout content', function (test) {
  class UnrelatedHelpers extends Iron.Controller {}
  UnrelatedHelpers.helpers({unrelated: function () { return 'x'; }});

  noRerenderCounts = {parent: 0, child: 0};
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    layout.render('ControllerNoRerenderTest');
    Tracker.flush();

    new UnrelatedHelpers({layout: layout, id: 1});
    Tracker.flush();
    new UnrelatedHelpers({layout: layout, id: 2});
    Tracker.flush();

    test.equal(el.innerHTML.compact(), "Static-Child");
    test.equal(noRerenderCounts.parent, 1, 'parent template created once');
    test.equal(noRerenderCounts.child, 1, 'included child template created once');
  });
});

var mixedCounts = {parent: 0, child: 0};
Template.ControllerMixedTest.onCreated(function () { mixedCounts.parent++; });
Template.ControllerMixedChild.onCreated(function () { mixedCounts.child++; });
Template.ControllerMixedTest.helpers({
  ctrlId: function () { var c = Iron.controller(); return c ? c.options.id : 'none'; }
});

Tinytest.add('Controller - a used helper and Iron.controller() update in place on a controller change', function (test) {
  class WhoHelpers extends Iron.Controller {}
  WhoHelpers.helpers({who: function () { return 'w' + this.options.id; }});

  mixedCounts = {parent: 0, child: 0};
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    layout.render('ControllerMixedTest');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Mixed--none-Child");

    new WhoHelpers({layout: layout, id: 1});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Mixed-w1-1-Child");

    new WhoHelpers({layout: layout, id: 2});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Mixed-w2-2-Child");

    new Iron.Controller({layout: layout, id: 3});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Mixed--3-Child");

    test.equal(mixedCounts.parent, 1, 'parent template created once');
    test.equal(mixedCounts.child, 1, 'included child template created once');
  });
});

// A nav in the layout that reads the controller-supplied data context (the
// common "active link" pattern) must follow route changes without the layout
// being rebuilt.
var navCreated = 0;
Template.ControllerNav.onCreated(function () { navCreated++; });
Template.ControllerNav.helpers({
  activeClass: function (name) { return this.navbarName === name ? 'on' : 'off'; }
});

Tinytest.add('Controller - a layout nav follows the controller data without a rebuild', function (test) {
  navCreated = 0;
  var layout = new Iron.Layout;
  withRenderedTemplate(layout.create(), function (el) {
    var c1 = new Iron.Controller({layout: layout});
    c1.layout('ControllerNavLayout', {data: function () { return {navbarName: 'stores'}; }});
    c1.render('ControllerNavPageA');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Nav-on-off|PageA");

    var c2 = new Iron.Controller({layout: layout});
    c2.layout('ControllerNavLayout', {data: function () { return {navbarName: 'users'}; }});
    c2.render('ControllerNavPageB');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), "Nav-off-on|PageB");
    test.equal(navCreated, 1, 'nav template created once');
  });
});
