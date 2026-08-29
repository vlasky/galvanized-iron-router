String.prototype.compact = function () {
  return this.trim().replace(/\s/g, '').replace(/\n/g, '');
};

const ReactiveVar = function (value) {
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
const reactiveTemplate = new ReactiveVar;

// a reactive data variable we can use
const reactiveData = new ReactiveVar;

const withDiv = function (callback) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  try {
    callback(el);
  } finally {
    document.body.removeChild(el);
  }
};

const withRenderedTemplate = function (template, callback) {
  withDiv((el) => {
    template = typeof template === 'string' ? Template[template] : template;
    Blaze.render(template, el);
    Tracker.flush();
    callback(el);
  });
};

Template.StaticData.helpers({
  getData: function () {
    return 'data';
  }
});

Template.Dynamic.helpers({
  getTemplate: function () {
    // like session.get
    return reactiveTemplate.get();
  }
});

Template.DynamicData.helpers({
  getData: function () {
    // like session.get
    return reactiveData.get();
  }
});

Template.DynamicParentData.helpers({
  getData: function () {
    const res = reactiveData.get();
    return res;
  }
});


Template.DynamicParentDataOnTemplateDynamic.helpers({
  getData: function () {
    const res = reactiveData.get();
    return res;
  }
});

Template.DynamicWithBlock.helpers({
  getTemplate: function () {
    // like session.get
    return reactiveTemplate.get();
  }
});

Tinytest.add('DynamicTemplate - Static rendering with no data', function (test) {
  withRenderedTemplate('Static', (el) => {
    test.equal(el.innerHTML.compact(), 'NoData');
  });
});

Tinytest.add('DynamicTemplate - Static rendering with nonreactive data helper', function (test) {
  withRenderedTemplate('StaticData', (el) => {
    test.equal(el.innerHTML.compact(), 'WithData-data');
  });
});

Tinytest.add('DynamicTemplate - Dynamic rendering with no data', function (test) {
  withRenderedTemplate('Dynamic', (el) => {
    // starts off empty
    test.equal(el.innerHTML.compact(), '');

    // change the reactive template variable
    reactiveTemplate.set('One');
    Tracker.flush();

    // new template should be on the page
    test.equal(el.innerHTML.compact(), 'One');

    // change it again!
    reactiveTemplate.set('Two');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'Two');

    // be a good citizen
    reactiveTemplate.clear();
  });
});

Tinytest.add('DynamicTemplate - Rendering with dynamic data', function (test) {
  let renderCount = 0;
  Template.WithData.rendered = function () {
    renderCount++;
  };

  reactiveData._value = 'init';

  withRenderedTemplate('DynamicData', (el) => {
    // we've rendered the template to the page
    test.equal(renderCount, 1);

    // but no data yet
    test.equal(el.innerHTML.compact(), 'WithData-init');

    // now set the data
    reactiveData.set('1');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // now set the data again
    reactiveData.set('2');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-2');

    reactiveData.clear();
  });
});

Tinytest.add('DynamicTemplate - Rendering with dynamic parent data', function (test) {
  let renderCount = 0;
  Template.WithData.rendered = function () {
    renderCount++;
  };

  // star the data value off as an empty string so the template still renders
  reactiveData._value = 'init';

  withRenderedTemplate('DynamicParentData', (el) => {
    // we've rendered the template to the page
    test.equal(renderCount, 1);

    // but no data yet
    test.equal(el.innerHTML.compact(), 'WithData-init');

    // now set the data
    reactiveData.set('1');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // now set the data again
    reactiveData.set('2');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-2');

    reactiveData.clear();
  });
});


Tinytest.add('DynamicTemplate - Rendering with dynamic parent data from Template.dynamic', function (test) {
  let renderCount = 0;
  Template.WithData.rendered = function () {
    renderCount++;
  };

  // star the data value off as an empty string so the template still renders
  reactiveData._value = 'init';

  withRenderedTemplate('DynamicParentDataOnTemplateDynamic', (el) => {
    // we've rendered the template to the page
    test.equal(renderCount, 1);

    // but no data yet
    test.equal(el.innerHTML.compact(), 'WithData-init');

    // now set the data
    reactiveData.set('1');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // now set the data again
    reactiveData.set('2');
    Tracker.flush();

    // should not re-render
    test.equal(renderCount, 1);

    // but data should be updated
    test.equal(el.innerHTML.compact(), 'WithData-2');

    reactiveData.clear();
  });
});

/*
Tinytest.add('DynamicTemplate - Rendering inherits data correctly', function (test) {
  withRenderedTemplate('InheritedParentData', function (el) {
    test.equal(el.innerHTML.compact(), 'WithDataAndParentData-inner-outer');
  });
});
*/


Tinytest.add('DynamicTemplate - Block content', function (test) {
  withRenderedTemplate('DynamicWithBlock', (el) => {
    // block content should be rendered since we don't have a template yet
    test.equal(el.innerHTML.compact(), 'default');

    // now set a template
    reactiveTemplate.set('One');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One');

    // go back to the default
    reactiveTemplate.set(undefined);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'default');
  });
});

Tinytest.add('DynamicTemplate - From JavaScript', function (test) {
  reactiveData._value = '1';

  const getData = function () {
    return reactiveData.get();
  };

  const tmpl = new Iron.DynamicTemplate({template: 'One', data: getData});

  // calling create() on the dynamic template creates and returns a new
  // View to be rendered.
  withRenderedTemplate(tmpl.create(), (el) => {
    test.equal(el.innerHTML.compact(), 'One');

    tmpl.template('WithData');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'WithData-1');

    // make sure reactivity works with data
    reactiveData.set('2');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'WithData-2');

    // now reset the data value completely
    tmpl.data('3');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'WithData-3');

    reactiveData.clear();
  });
});

Tinytest.add('DynamicTemplate - insert accepts a direct element', function (test) {
  const el = document.createElement('div');
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});
  document.body.appendChild(el);

  try {
    tmpl.insert({el: el});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One');
  } finally {
    tmpl.destroy();
    el.remove();
  }
});

Tinytest.add('DynamicTemplate - insert resolves a CSS selector', function (test) {
  const el = document.createElement('div');
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});
  el.id = 'dynamic-template-insert-target';
  document.body.appendChild(el);

  try {
    tmpl.insert({el: '#dynamic-template-insert-target'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One');
  } finally {
    tmpl.destroy();
    el.remove();
  }
});

Tinytest.add('DynamicTemplate - insert rejects a missing selector', function (test) {
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});

  test.throws(function () {
    tmpl.insert({el: '#dynamic-template-missing-target'});
  }, /No element to insert layout into/);
});

Tinytest.add('DynamicTemplate - insert unwraps an array-like element wrapper', function (test) {
  const el = document.createElement('div');
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});
  document.body.appendChild(el);

  try {
    // e.g. a jQuery collection, which insert() has accepted since 1.x
    tmpl.insert({el: {0: el, length: 1}});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One');
  } finally {
    tmpl.destroy();
    el.remove();
  }
});

Tinytest.add('DynamicTemplate - insert rejects an empty array-like wrapper', function (test) {
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});

  test.throws(function () {
    tmpl.insert({el: {length: 0}});
  }, /No element to insert layout into/);
});

Tinytest.add('DynamicTemplate - default template', function (test) {
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});

  // calling create() on the dynamic template creates and returns a new
  // UI.Component to be rendered.
  withRenderedTemplate(tmpl.create(), (el) => {
    test.equal(el.innerHTML.compact(), 'One', 'default template not set from options');

    tmpl.template('Two');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'Two', 'default template not replaced');

    tmpl.template(false);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');

    tmpl.template(null);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');

    tmpl.template(undefined);
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'One', 'fallback to default');
  });
});

Tinytest.add('DynamicTemplate - view lifecycle callbacks', function (test) {
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'One'});
  const calls = [];

  ['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'].forEach(function (hook) {
    tmpl[hook](function (dynamicTemplate) {
      calls.push({
        name: hook,
        dynamicTemplate: dynamicTemplate,
        thisArg: this
      });
    });
  });

  // calling create() on the dynamic template creates and returns a new
  // UI.Component to be rendered.
  let call;
  withRenderedTemplate(tmpl.create(), (el) => {
    test.equal(calls.length, 3, 'onViewCreated, _onViewRendered and onViewReady');

    call = calls[0];
    test.equal(call.name, 'onViewCreated');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    call = calls[1];
    test.equal(call.name, '_onViewRendered');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    call = calls[2];
    test.equal(call.name, 'onViewReady');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);

    tmpl.destroy();
    call = calls[3];
    test.equal(call.name, 'onViewDestroyed');
    test.instanceOf(call.dynamicTemplate, Iron.DynamicTemplate);
    test.instanceOf(call.thisArg, Blaze.View);
  });
});

const calls = [];

Template.EventsTest.events({
  'click': function (e, tmpl) {
  }
});

Tinytest.add('DynamicTemplate - event handlers', function (test) {
  const tmpl = new Iron.DynamicTemplate({defaultTemplate: 'EventsTest'});

  let calls = 0;
  const thisArg = {};

  // first test creating events before rendering
  tmpl.events({
    'click': function (e, tmpl) {
      test.equal(this, thisArg);
      test.isTrue(e);
      test.isTrue(tmpl);
      calls++;
    }
  }, thisArg);

  withRenderedTemplate(tmpl.create(), (el) => {
    const target = el.querySelector('.click');
    target.click();
    test.equal(calls, 1);

    // now change the events
    tmpl.events({
      'click': function (e, tmpl) {
        test.isTrue(this.isNew);
        test.isTrue(e);
        test.isTrue(tmpl);
        calls++;
      }
    }, {isNew: true});

    target.click();
    test.equal(calls, 2);
  });
});


Tinytest.add('DynamicTemplate - lookup hosts', function (test) {
  const tmpl = new Iron.DynamicTemplate({template: 'LookupHostTest'});
  let counter = 0;
  let helperRunCount = 0;

  const Controller = function () {
    this.counter = ++counter;
  };

  Controller._helpers = {};
  Controller._helpers.getValue = function () {
    helperRunCount++;
    return this.counter;
  };


  // start off with no controller at the time of render
  withRenderedTemplate(tmpl.create(), (el) => {
    // then add a controller
    tmpl._setLookupHost(new Controller);

    // Flush twice to ensure all reactive updates and afterFlush callbacks complete
    Tracker.flush();
    Tracker.flush();

    test.equal(counter, 1);
    test.equal(helperRunCount, 1);
    test.equal(el.innerHTML.compact(), '1');
  });
});

Template.NearestObjectData.helpers({
  outerPrimitive: function () {
    return 'outer-primitive';
  },
  innerObject: function () {
    return {name: 'inner'};
  }
});
Tinytest.add('DynamicTemplate - nearest object data context beats farther primitive', function (test) {
  // Regression: getDataContext() deferred the nearest valid object while it
  // kept walking, so a primitive further up the view tree won.
  withRenderedTemplate('NearestObjectData', (el) => {
    test.equal(el.innerHTML.compact(), 'inner');
  });
});

Template.HijackHost.helpers({
  hijackData: function () {
    // a perfectly ordinary data context that happens to have a "data" key
    return {data: 'wrong-data', name: 'x'};
  }
});
Tinytest.add('DynamicTemplate - absent data argument not hijacked by data context property', function (test) {
  // Regression: the DynamicTemplate helper resolved its "data" argument via
  // view.lookup() when no data= was given, so a data context with a "data"
  // property replaced the inherited parent context.
  withRenderedTemplate('HijackHost', (el) => {
    test.equal(el.innerHTML.compact(), 'real-x');
  });
});

Template.ExtraArgsHost.helpers({
  parentData: function () {
    return {name: 'parent'};
  }
});
Tinytest.add('DynamicTemplate - extra inclusion arguments do not become the data context', function (test) {
  // {{> DynamicTemplate template="ShowName" extra="e"}} inside {{#with}}:
  // the argument wrapper {template, extra} is control arguments for Iron's
  // helper, not a data context, even though it mixes reserved and ordinary
  // keys. The template must inherit the parent data.
  withRenderedTemplate('ExtraArgsHost', (el) => {
    test.equal(el.innerHTML.compact(), 'parent');
  });
});

Template.ValueDataHost.helpers({
  valueData: function () {
    return {value: 42};
  }
});
Tinytest.add('DynamicTemplate - data context literally shaped {value: X} survives', function (test) {
  // Published Blaze 3.x wraps EVERY with-view data context as {value: data}
  // (Blaze.getData itself reads dataVar.get()?.value), so a genuine
  // {value: 42} context arrives double-wrapped and one unwrap returns it
  // intact. This pins that contract: it fails if a future Blaze stops
  // wrapping dataVar while _unwrapBlaze3Value still strips the shape.
  withRenderedTemplate('ValueDataHost', (el) => {
    test.equal(el.innerHTML.compact(), 'v-42');
  });
});
