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

Tinytest.add('Layout - Template layout with block content', function (test) {
  withRenderedTemplate('BlockLayout', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-main-footer');
  });
});

Template.BlockLayoutWithData.helpers({
  getData: function () {
    return 'data';
  }
});
Tinytest.add('Layout - Template layout with block content and data', function (test) {
  withRenderedTemplate('BlockLayoutWithData', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-data-main-data-footer-data');
  });
});

Template.BlockLayoutWithOuterData.data = null;
Template.BlockLayoutWithOuterData.helpers({
  getData: function () {
    return Template.BlockLayoutWithOuterData.data;
  }
});

Tinytest.add('Layout - data - yield inherits data from outside by default', function (test) {
  Template.BlockLayoutWithOuterData.data = undefined;
  withRenderedTemplate('BlockLayoutWithOuterData', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-outerData-inner-outerData');
  });
});

Tinytest.add('Layout - data - yield inherits data layout if defined', function (test) {
  Template.BlockLayoutWithOuterData.data = 'layoutData';
  withRenderedTemplate('BlockLayoutWithOuterData', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-layoutData-inner-layoutData');
  });
});

Template.BlockLayoutWithOuterDataAndWith.data = null;
Template.BlockLayoutWithOuterDataAndWith.helpers({
  getData: function () {
    return Template.BlockLayoutWithOuterDataAndWith.data;
  }
});

Tinytest.add('Layout - data - with in context trumps all else', function (test) {
  Template.BlockLayoutWithOuterDataAndWith.data = undefined;
  withRenderedTemplate('BlockLayoutWithOuterDataAndWith', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-outerData-inner-innerData');
  });
});

Tinytest.add('Layout - data - with in context trumps layout data', function (test) {
  Template.BlockLayoutWithOuterDataAndWith.data = 'layoutData';
  withRenderedTemplate('BlockLayoutWithOuterDataAndWith', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-layoutData-inner-innerData');
  });
});

Tinytest.add('Layout - data - render always clears data', function (test) {
  const layout = new Iron.Layout;

  withRenderedTemplate(layout.create(), (el) => {
    layout.template('LayoutOne');
    layout.render('LayoutTestOne', {data: 'firstData'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One-firstData-');

    // rendering with no data, should now not have data
    layout.render('LayoutTestOne')
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One--');
  });
});

// see https://github.com/EventedMind/iron-router/issues/693
Tinytest.add('Layout - data - in-place changes to data are not missed', function(test) {
  const layout = new Iron.Layout;
  const Posts = new Meteor.Collection(null);
  Posts.insert({foo: 'bar'});

  withRenderedTemplate(layout.create(), (el) => {
    layout.template('LayoutOne');
    layout.data(function() {
      return Posts.findOne();
    });
    layout.render('OneFoo');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One-bar-');

    const post = layout.data(); // grab the internal reference, if exists
    post.foo = 'baz';
    Posts.update(post._id, {$set: {foo: post.foo}});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One-baz-');
  });
});


Tinytest.add('Layout - JavaScript layout', function (test) {
  const layout = new Iron.Layout;

  withRenderedTemplate(layout.create(), (el) => {
    // starts off empty
    test.equal(el.innerHTML.compact(), '');

    // then we'll choose a layout
    layout.template('LayoutWithData');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout--');

    // render the One template into the main region
    layout.render('LayoutTestOne');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout--One--');

    // now render Two into the footer region
    layout.render('LayoutTestTwo', {to: 'footer'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout--One--Two--');


    // now set a global layout data context!
    layout.data('DATA');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-DATA-One-DATA-Two-DATA-');

    // and finally let's override some specific region data contexts!
    layout.render('LayoutTestOne', {data: 'ONE'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-DATA-One-ONE-Two-DATA-');

    layout.render('LayoutTestTwo', {to: 'footer', data: 'TWO'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-DATA-One-ONE-Two-TWO-');
  });
});

Tinytest.add('Layout - JavaScript rendering transactions', function (test) {
  const layout = new Iron.Layout({template: 'RenderingTransactionsLayout'});


  withRenderedTemplate(layout.create(), (el) => {
    // start the transaction and provide an oncomplete callback
    const calls = [];
    layout.beginRendering(function onComplete(regions) {
      calls.push({
        regions: regions
      });
    });
    // render the LayoutOnePage template into the main region
    // this should also render "footer" through a contentFor block
    layout.render('LayoutOnePage');
    layout.render('Aside', {to: 'aside'});

    Tracker.flush();
    test.equal(calls.length, 1);
    test.equal(calls[0].regions, ['main', 'aside', 'footer']);
  });
});

Tinytest.add('Layout - rendering transactions multiple calls to beginRendering', function (test) {
  const layout = new Iron.Layout({template: 'RenderingTransactionsLayout'});

  withRenderedTemplate(layout.create(), (el) => {
    // start the transaction and provide an oncomplete callback
    const calls = [];

    const onComplete = function onComplete (regions) {
      calls.push({
        regions: regions
      });
    };

    layout.beginRendering(onComplete);

    // render the LayoutOnePage template into the main region
    // this should also render "footer" through a contentFor block
    layout.render('LayoutOnePage');
    layout.render('Aside', {to: 'aside'});

    // now before we flush call beginRendering again. the previous transaction
    // should immediately complete
    layout.beginRendering(onComplete);

    // this time our onComplete should only register the main region being
    // rendered.
    layout.render('LayoutOnePage');

    // now actually flush
    Tracker.flush();
    test.equal(calls.length, 2, "onComplete called for both rendering transactions");

    // first time, the rendered regions only include the programmatic ones
    // because the contentFor doesn't have a change to run.
    let regions = calls[0].regions;
    test.equal(regions.length, 2);
    test.isTrue(regions.includes("main"));
    test.isTrue(regions.includes("aside"));

    regions = calls[1].regions;
    test.equal(regions.length, 2);
    test.isTrue(regions.includes("main"));
    test.isTrue(regions.includes("footer"));
  });
});

Tinytest.add('Layout - has, clear and clearAll', function (test) {
  const layout = new Iron.Layout({template: 'LayoutOne'});

  withRenderedTemplate(layout.create(), (el) => {
    // just make sure we're starting off correctly
    test.equal(el.innerHTML.compact(), 'layout-');

    // we have a main region {{> yield}}
    test.isTrue(layout.has());

    // we also should have a footer region {{> yield "footer"}}
    test.isTrue(layout.has('footer'));

    // we should not have some bogus region
    test.isFalse(layout.has('bogus'));

    // render the One template into the main region
    layout.render('LayoutTestOne');
    Tracker.flush();

    // now render Two into the footer region
    layout.render('LayoutTestTwo', {to: 'footer'});
    Tracker.flush();

    // make sure everything rendered correctly
    test.equal(el.innerHTML.compact(), 'layout-One--Two--');

    // now clear footer region
    layout.clear("footer");
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One--');

    // clear main region
    layout.clear();
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-');

    // now build it back up again and clearAll
    layout.render('LayoutTestOne');
    layout.render('LayoutTestTwo', {to: 'footer'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-One--Two--');

    layout.clearAll();
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-');
  });
});

Tinytest.add('Layout - default layout', function (test) {
  // no default template
  const layout = new Iron.Layout;

  withRenderedTemplate(layout.create(), (el) => {
    layout.render('Plain');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'plain', 'no default layout');
  });
});

Tinytest.add('Layout - hasRegion', function (test) {
  const layout = new Iron.Layout;

  withRenderedTemplate(layout.create(), (el) => {
    layout.template('LayoutWithHasRegion');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'no', 'hasRegion mis-reported true');

    layout.render('LayoutTestOne', {to: 'test'});
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'yes', 'hasRegion mis-reported false');
  });
});

Tinytest.add('Layout - bare yield unaffected by enclosing inclusion arguments', function (test) {
  // Regression: {{> yield}} inside a template that was itself included with
  // a region= argument ({{> BoundaryWidget region="sidebar"}}) walked past
  // its template boundary, adopted region="sidebar" and rendered the wrong
  // region.
  const layout = new Iron.Layout({template: 'BoundaryLayout'});

  withRenderedTemplate(layout.create(), (el) => {
    layout.render('Plain');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-[plain]');
  });
});

Template.StringDataLayout.helpers({
  stringRegionLikeData: function () {
    return 'aside';
  }
});
Tinytest.add('Layout - bare yield unaffected by a string data context', function (test) {
  // Regression: getInclusionArguments() fell back to Blaze.getData() and
  // treated any string data context as a positional region argument, so the
  // yield rendered region "aside" instead of the main region.
  const layout = new Iron.Layout({template: 'StringDataLayout'});

  withRenderedTemplate(layout.create(), (el) => {
    layout.render('Plain');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-[plain]');
  });
});

Template.ReactiveTemplateLayout.helpers({
  layoutTemplate: function () {
    return reactiveTemplate.get();
  }
});
Tinytest.add('Layout - reactive template argument to Layout block helper', function (test) {
  // Regression: DynamicTemplate.args() snapshotted arguments nonreactively
  // forever, freezing {{#Layout template=myReactiveTemplate}}.
  reactiveTemplate.set('LayoutRed');
  withRenderedTemplate('ReactiveTemplateLayout', (el) => {
    test.equal(el.innerHTML.compact(), 'red-main');

    reactiveTemplate.set('LayoutBlue');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'blue-main');
  });
});

Template.ReactiveDataLayout.helpers({
  layoutData: function () {
    return reactiveData.get();
  }
});
Tinytest.add('Layout - reactive data argument to Layout block helper', function (test) {
  reactiveData.set('one');
  withRenderedTemplate('ReactiveDataLayout', (el) => {
    test.equal(el.innerHTML.compact(), 'layout-one-main-one');

    reactiveData.set('two');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'layout-two-main-two');
  });
});

// a reactive region name we can use
const reactiveRegion = new ReactiveVar;

Template.ReactiveRegionLayout.helpers({
  contentRegion: function () {
    return reactiveRegion.get();
  }
});
Tinytest.add('Layout - reactive region argument to contentFor clears the old region', function (test) {
  // When a reactive region= changes, the previously populated region must be
  // cleared, not left rendering the same content in two places.
  reactiveRegion.set('footer');
  withRenderedTemplate('ReactiveRegionLayout', (el) => {
    test.equal(el.innerHTML.compact(), 'm[]a[stuff]b[]');

    reactiveRegion.set('aside');
    Tracker.flush();
    test.equal(el.innerHTML.compact(), 'm[]a[]b[stuff]');
  });
});

Tinytest.add('Layout - region lifecycle callbacks fire', function (test) {
  // The bridge from the region template's view hooks looked the public
  // callback name up under the wrong key and ran "onundefined": none of
  // onRegionCreated/onRegionRendered/onRegionDestroyed ever fired.
  const layout = new Iron.Layout({template: 'LayoutOne'});
  const events = [];

  layout.onRegionCreated(function (region, tmpl, owner) {
    events.push(['created', region, tmpl === layout._regions[region], owner === layout, this === tmpl.view]);
  });
  layout.onRegionRendered(function (region) { events.push(['rendered', region]); });
  layout.onRegionDestroyed(function (region) { events.push(['destroyed', region]); });

  const has = (kind, region) => events.some((e) => e[0] === kind && e[1] === region);

  withDiv((el) => {
    const view = Blaze.render(layout.create(), el);
    Tracker.flush();

    test.isTrue(has('created', 'main'), 'main region created');
    test.isTrue(has('created', 'footer'), 'footer region created');
    test.isTrue(has('rendered', 'main'), 'main region rendered');
    const created = events.find((e) => e[0] === 'created' && e[1] === 'main');
    test.equal(created.slice(2), [true, true, true],
      'callback receives the region name, its dynamic template and the layout, with the view as this');

    Blaze.remove(view);
    test.isTrue(has('destroyed', 'main'), 'main region destroyed');
    test.isTrue(has('destroyed', 'footer'), 'footer region destroyed');
  });
});

Tinytest.add('Layout - yielding a region inside its own content raises a descriptive error', function (test) {
  // A page template with a bare {{> yield}} (or the layout template itself
  // rendered as a page) yields the main region from inside the main region's
  // own content. Blaze.remove on the half-rendered view used to fail with the
  // opaque "Expected template rendered with Blaze.render" (upstream #1218).
  const layout = new Iron.Layout({template: 'LayoutOne'});

  withRenderedTemplate(layout.create(), (el) => {
    layout.render('SelfYieldPage');
    test.throws(() => {
      Tracker.flush({_throwFirstError: true});
    }, /"main" region is yielded inside its own content/);
  });
});
