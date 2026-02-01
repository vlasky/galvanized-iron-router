import { Blaze } from 'meteor/blaze';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { Iron } from '../core/iron_core.js';
import { DynamicTemplate } from '../dynamic-template/dynamic_template.js';

// UI is the deprecated name for Blaze, needed for UI.registerHelper
const UI = Blaze;

/*****************************************************************************/
/* Imports */
/*****************************************************************************/

/*****************************************************************************/
/* Helpers */
/*****************************************************************************/
/**
 * Find the first Layout in the rendered parent hierarchy.
 */
const findFirstLayout = function (view) {
  while (view) {
    if (view.name === 'Iron.Layout')
      return view.__dynamicTemplate__;
    else
      view = view.parentView;
  }

  return null;
};

/*****************************************************************************/
/* Layout */
/*****************************************************************************/

/**
 * The default region for a layout where the main content will go.
 */
const DEFAULT_REGION = 'main';

/**
 * Dynamically render templates into regions.
 *
 * Layout inherits from Iron.DynamicTemplate and provides the ability to create
 * regions that a user can render templates or content blocks into. The layout
 * and each region is an instance of DynamicTemplate so the template and data
 * contexts are completely dynamic and programmable in javascript.
 */
class Layout extends DynamicTemplate {
  /**
   * The default region for a layout where the main content will go.
   */
  static DEFAULT_REGION = DEFAULT_REGION;

  constructor(options) {
    super(options);

    options = options || {};
    this.name = 'Iron.Layout';
    this._regions = {};
    this._regionHooks = {};
    this.defaultTemplate('__IronDefaultLayout__');

    // if there's block content then render that
    // to the main region
    if (options.content)
      this.render(options.content);
  }

  /**
   * Return the DynamicTemplate instance for a given region. If the region doesn't
   * exist it is created.
   *
   * The regions object looks like this:
   *
   *  {
   *    "main": DynamicTemplate,
   *    "footer": DynamicTemplate,
   *    .
   *    .
   *    .
   *  }
   */
  region(name, options) {
    return this._ensureRegion(name, options);
  }

  /**
   * Destroy all child regions and reset the regions map.
   */
  destroyRegions() {
    Object.keys(this._regions).forEach((key) => {
      this._regions[key].destroy();
    });

    this._regions = {};
  }

  /**
   * Set the template for a region.
   */
  render(template, options) {
    // having options is usually good
    options = options || {};

    // let the user specify the region to render the template into
    const region = options.to || options.region || DEFAULT_REGION;

    // get the DynamicTemplate for this region
    const dynamicTemplate = this.region(region);

    // if we're in a rendering transaction, track that we've rendered this
    // particular region
    this._trackRenderedRegion(region);

    // set the template value for the dynamic template
    dynamicTemplate.template(template);

    // set the data for the region. If options.data is not defined, this will
    // clear the data, which is what we want
    dynamicTemplate.data(options.data);

    // return the dynamicTemplate so caller can chain .data() calls
    return dynamicTemplate;
  }

  /**
   * Returns true if the given region is defined and false otherwise.
   */
  has(region) {
    region = region || Layout.DEFAULT_REGION;
    return !!this._regions[region];
  }

  /**
   * Returns an array of region keys.
   */
  regionKeys() {
    return Object.keys(this._regions);
  }

  /**
   * Clear a given region or the "main" region by default.
   */
  clear(region) {
    region = region || Layout.DEFAULT_REGION;

    // we don't want to create a region if it didn't exist before
    if (this.has(region))
      this.region(region).template(null);

    // chain it up
    return this;
  }

  /**
   * Clear all regions.
   */
  clearAll() {
    Object.keys(this._regions).forEach((key) => {
      this._regions[key].template(null);
    });

    // chain it up
    return this;
  }

  /**
   * Start tracking rendered regions.
   */
  beginRendering(onComplete) {
    if (this._finishRenderingTransaction)
      this._finishRenderingTransaction();

    let called = false;
    this._finishRenderingTransaction = () => {
      if (called) return;
      called = true;
      const regions = this._endRendering({flush: false});
      onComplete && onComplete(regions);
    };

    Tracker.afterFlush(this._finishRenderingTransaction);

    if (this._renderedRegions)
      throw new Error("You called beginRendering again before calling endRendering");
    this._renderedRegions = {};
  }

  /**
   * Track a rendered region if we're in a transaction.
   */
  _trackRenderedRegion(region) {
    if (!this._renderedRegions)
      return;
    this._renderedRegions[region] = true;
  }

  /**
   * Stop a rendering transaction and retrieve the rendered regions. This
   * shouldn't be called directly. Instead, pass an onComplete callback to the
   * beginRendering method.
   */
  _endRendering(opts) {
    // we flush here to ensure all of the {{#contentFor}} inclusions have had a
    // chance to render from our templates, otherwise we'll never know about
    // them.
    opts = opts || {};
    if (opts.flush !== false)
      Tracker.flush();
    const renderedRegions = this._renderedRegions || {};
    this._renderedRegions = null;
    return Object.keys(renderedRegions);
  }

  /**
   * View lifecycle hook: onRegionCreated
   */
  onRegionCreated(cb) {
    const hooks = this._regionHooks['onRegionCreated'] = this._regionHooks['onRegionCreated'] || [];
    hooks.push(cb);
    return this;
  }

  /**
   * View lifecycle hook: onRegionRendered
   */
  onRegionRendered(cb) {
    const hooks = this._regionHooks['onRegionRendered'] = this._regionHooks['onRegionRendered'] || [];
    hooks.push(cb);
    return this;
  }

  /**
   * View lifecycle hook: onRegionDestroyed
   */
  onRegionDestroyed(cb) {
    const hooks = this._regionHooks['onRegionDestroyed'] = this._regionHooks['onRegionDestroyed'] || [];
    hooks.push(cb);
    return this;
  }

  /**
   * Returns the DynamicTemplate for a given region or creates it if it doesn't
   * exists yet.
   */
  _ensureRegion(name, options) {
   return this._regions[name] = this._regions[name] || this._createDynamicTemplate(name, options);
  }

  /**
   * Create a new DynamicTemplate instance.
   */
  _createDynamicTemplate(name, options) {
    const tmpl = new Iron.DynamicTemplate(options);
    const capitalize = Iron.utils.capitalize;
    tmpl._region = name;

    ['viewCreated', 'viewReady', 'viewDestroyed'].forEach((hookName) => {
      const capitalizedHook = capitalize(hookName);
      tmpl['on' + capitalizedHook]((dynamicTemplate) => {
        // Arrow function captures 'this' (the Layout) from enclosing scope.
        // The view is available via dynamicTemplate.view
        const view = dynamicTemplate.view;
        const regionHook = ({
          viewCreated: "regionCreated",
          viewReady: "regionRendered",
          viewDestroyed: "regionDestroyed"
        })[capitalizedHook];
        this._runRegionHooks('on' + regionHook, view, dynamicTemplate);
      });
    });

    return tmpl;
  }

  _runRegionHooks(name, regionView, regionDynamicTemplate) {
    const hooks = this._regionHooks[name] || [];

    for (let i = 0; i < hooks.length; i++) {
      const hook = hooks[i];
      // keep the "thisArg" pointing to the view, but make the first parameter to
      // the callback teh dynamic template instance.
      hook.call(regionView, regionDynamicTemplate.region, regionDynamicTemplate, this);
    }
  }
}

/*****************************************************************************/
/* UI Helpers */
/*****************************************************************************/
if (typeof Template !== 'undefined') {
  /**
   * Create a region in the closest layout ancestor.
   *
   * Examples:
   *    <aside>
   *      {{> yield "aside"}}
   *    </aside>
   *
   *    <article>
   *      {{> yield}}
   *    </article>
   *
   *    <footer>
   *      {{> yield "footer"}}
   *    </footer>
   */
  UI.registerHelper('yield', new Template('yield', function () {
    const view = this;
    const layout = findFirstLayout(view);

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use yield!");

    // Use DynamicTemplate.args for snapshot-at-render behavior
    const args = DynamicTemplate.args(view);

    // Example options: {{> yield region="footer"}} or {{> yield "footer"}}
    let region = args('region');

    // If no named region arg, check for positional string argument
    if (!region) {
      const options = args();
      if (typeof options === 'string') {
        region = options;
      }
    }

    // if there's no region specified we'll assume you meant the main region
    region = region || DEFAULT_REGION;

    // get or create the region
    const dynamicTemplate = layout.region(region);

    // if the dynamicTemplate had already been inserted, let's
    // destroy it before creating a new one.
    if (dynamicTemplate.isCreated)
      dynamicTemplate.destroy();

    // now return a newly created view
    return dynamicTemplate.create();
  }));

  /**
   * Render a template into a region in the closest layout ancestor from within
   * your template markup.
   *
   * Examples:
   *
   *  {{#contentFor "footer"}}
   *    Footer stuff
   *  {{/contentFor}}
   *
   *  {{> contentFor region="footer" template="SomeTemplate" data=someData}}
   *
   * Note: The helper is a UI.Component object instead of a function so that
   * Meteor UI does not create a Deps.Dependency.
   *
   * XXX what happens if the parent that calls contentFor gets destroyed?
   * XXX the layout.region should be reset to be empty?
   * XXX but how do we control order of setting the region? what if it gets destroyed but then something else sets it?
   *
   */
  UI.registerHelper('contentFor', new Template('contentFor', function () {
    const view = this;
    const layout = findFirstLayout(view);

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use contentFor!");

    // Use DynamicTemplate.args for snapshot-at-render behavior
    const args = DynamicTemplate.args(view);

    const content = view.templateContentBlock;
    const template = args('template');
    const data = args('data');
    let region = args('region');

    // If no named region arg, check for positional string argument
    // e.g., {{#contentFor "footer"}}...{{/contentFor}}
    if (!region) {
      const options = args();
      if (typeof options === 'string') {
        region = options;
      }
    }

    if (!region)
      throw new Error("Which region is this contentFor block supposed to be for?");

    // set the region to a provided template or the content directly.
    layout.region(region).template(template || content);

    // tell the layout to track this as a rendered region if we're in a
    // rendering transaction.
    layout._trackRenderedRegion(region);

    // if we have some data then set the data context
    if (data)
      layout.region(region).data(data);

    // just render nothing into this area of the page since the dynamic template
    // will do the actual rendering into the right region.
    return null;
  }));

  /**
   * Check to see if a given region is currently rendered to.
   *
   * Example:
   *    {{#if hasRegion 'aside'}}
   *      <aside>
   *        {{> yield "aside"}}
   *      </aside>
   *    {{/if}}
   */
  UI.registerHelper('hasRegion', function (region) {
    const layout = findFirstLayout(Blaze.getView());

    if (!layout)
      throw new Error("No Iron.Layout found so you can't use hasRegion!");

    if (typeof region !== 'string')
      throw new Error("You need to provide an region argument to hasRegion");

    return !! layout.region(region).template();
  });

  /**
   * Let people use Layout directly from their templates!
   *
   * Example:
   *  {{#Layout template="MyTemplate"}}
   *    Main content goes here
   *
   *    {{#contentFor "footer"}}
   *      footer goes here
   *    {{/contentFor}}
   *  {{/Layout}}
   */
  UI.registerHelper('Layout', new Template('layout', function () {
    const view = this;

    // Use DynamicTemplate.args for snapshot-at-render behavior
    const args = DynamicTemplate.args(view);

    // Get block content - try multiple sources for Blaze 3.0 compatibility
    let blockContent = view.templateContentBlock;

    // Blaze 3.0 might store content block differently
    if (!blockContent && view._templateContentBlock) {
      blockContent = view._templateContentBlock;
    }

    // Try Template.contentBlock if available
    if (!blockContent && Template.contentBlock) {
      blockContent = Template.contentBlock;
    }

    const layout = new Layout({
      template: function () { return args('template'); },
      data: function () { return args('data'); },
      content: blockContent
    });

    return layout.create();
  }));
}
export { Layout, DEFAULT_REGION };

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Layout = Layout;
