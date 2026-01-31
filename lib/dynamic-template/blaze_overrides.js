import { Blaze } from 'meteor/blaze';
import { Iron } from '../core/iron_core.js';
import { DynamicTemplate } from './dynamic_template.js';

const get = Iron.utils.get;

/*****************************************************************************/
/* Blaze Overrides */
/*****************************************************************************/
/**
 * Adds ability to inject lookup hosts into views that can participate in
 * property lookup. For example, iron:controller or iron:component could make
 * use of this to add methods into the lookup chain. If the property is found,
 * a function is returned that either returns the property value or the result
 * of calling the function (bound to the __lookupHost__).
 */
const origLookup = Blaze.View.prototype.lookup;
Blaze.View.prototype.lookup = function (name /*, args */) {
  const host = DynamicTemplate.findLookupHostWithHelper(Blaze.getView(), name);

  if (host) {
    return function callLookupHostHelper (/* args */) {
      const helper = get(host, 'constructor', '_helpers', name);
      const args = [].slice.call(arguments);
      return (typeof helper === 'function') ? helper.apply(host, args) : helper;
    }
  } else {
    return origLookup.apply(this, arguments);
  }
};
