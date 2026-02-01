import { Meteor } from 'meteor/meteor';
import { EJSON } from 'meteor/ejson';

const Iron = {};
Iron.utils = {};

/**
 * Assert that the given condition is truthy and throw an error if not.
 */

Iron.utils.assert = function (condition, msg) {
  if (!condition)
    throw new Error(msg);
};

/**
 * Print a warning message to the console if the console is defined.
 */
Iron.utils.warn = function (condition, msg) {
  if (!condition)
    console && console.warn && console.warn(msg);
};

/**
 * Given a target object and a property name, if the value of that property is
 * undefined, set a default value and return it. If the value is already
 * defined, return the existing value.
 */
Iron.utils.defaultValue = function (target, prop, value) {
  if (typeof target[prop] === 'undefined') {
    target[prop] = value;
    return value;
  } else {
    return target[prop]
  }
};

/**
 * Make one constructor function inherit from another. Optionally provide
 * prototype properties for the child.
 *
 * @param {Function} Child The child constructor function.
 * @param {Function} Parent The parent constructor function.
 * @param {Object} [props] Prototype properties to add to the child
 */
Iron.utils.inherits = function (Child, Parent, props) {
  Iron.utils.assert(typeof Child !== "undefined", "Child is undefined in inherits function");
  Iron.utils.assert(typeof Parent !== "undefined", "Parent is undefined in inherits function");

  // copy static fields (including inherited ones for ES6 class compatibility)
  for (const key in Parent) {
    if (Object.prototype.hasOwnProperty.call(Parent, key))
      Child[key] = EJSON.clone(Parent[key]);
  }

  // Also copy static methods that may be inherited from ES6 class parent chain
  // These won't be enumerable own properties but should be available
  const staticMethods = ['extend', 'events', '_collectEventMaps', 'helpers'];
  staticMethods.forEach(method => {
    if (typeof Parent[method] === 'function' && !Child[method]) {
      Child[method] = Parent[method];
    }
  });

  const Middle = function () {
    this.constructor = Child;
  };

  // hook up the proto chain
  Middle.prototype = Parent.prototype;
  Child.prototype = new Middle;
  Child.__super__ = Parent.prototype;

  // copy over the prototype props
  if (typeof props === 'object' && props !== null)
    Object.assign(Child.prototype, props);

  return Child;
};

/**
 * Create a new constructor function that inherits from Parent and copy in the
 * provided prototype properties.
 *
 * @param {Function} Parent The parent constructor function.
 * @param {Object} [props] Prototype properties to add to the child
 */
Iron.utils.extend = function (Parent, props) {
  props = props || {};

  // Check if Parent is an ES6 class (cannot be called without new)
  const isES6Class = /^class\s/.test(Parent.toString()) ||
    (Parent.prototype && Parent.prototype.constructor &&
     /^class\s/.test(Parent.prototype.constructor.toString()));

  let ctor;
  if (isES6Class) {
    // For ES6 classes, we need to use Reflect.construct or create a proper subclass
    // We create a class that extends the parent and adds the props
    ctor = function (...args) {
      if (!(this instanceof ctor)) {
        throw new TypeError("Class constructor cannot be invoked without 'new'");
      }
      // Use Reflect.construct for proper ES6 class instantiation
      const instance = Reflect.construct(Parent, args, ctor);
      // Copy any own properties set during construction
      Object.keys(this).forEach(key => {
        if (!(key in instance)) {
          instance[key] = this[key];
        }
      });
      // Call custom constructor if provided
      if (Object.prototype.hasOwnProperty.call(props, 'constructor') && props.constructor !== ctor) {
        props.constructor.apply(instance, args);
      }
      return instance;
    };
  } else {
    ctor = function () {
      // automatically call the parent constructor if a new one
      // isn't provided.
      let constructor;
      if (Object.prototype.hasOwnProperty.call(props, 'constructor'))
        constructor = props.constructor
      else
        constructor = ctor.__super__.constructor;

      constructor.apply(this, arguments);
    };
  }

  return Iron.utils.inherits(ctor, Parent, props);
};

/**
 * Either window in the browser or global in NodeJS.
 */
Iron.utils.global = (function () {
  return Meteor.isClient ? window : global;
})();

/**
 * Ensure a given namespace exists and assign it to the given value or
 * return the existing value.
 */
Iron.utils.namespace = function (namespace, value) {
  const global = Iron.utils.global;

  Iron.utils.assert(typeof namespace === 'string', "namespace must be a string");

  const parts = namespace.split('.');
  const name = parts.pop();
  let ptr = global;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    ptr = ptr[part] = ptr[part] || {};
  }

  if (arguments.length === 2) {
    ptr[name] = value;
    return value;
  } else {
    return ptr[name];
  }
};

/**
 * Returns the resolved value at the given namespace or the value itself if it's
 * not a string.
 *
 * Example:
 *
 * var Iron = {};
 * Iron.foo = {};
 *
 * var baz = Iron.foo.baz = {};
 * Iron.utils.resolve("Iron.foo.baz") === baz
 */
Iron.utils.resolve = function (nameOrValue) {
  const global = Iron.utils.global;
  let ptr;

  if (typeof nameOrValue === 'string') {
    const parts = nameOrValue.split('.');
    ptr = global;
    for (let i = 0; i < parts.length; i++) {
      ptr = ptr[parts[i]];
      if (!ptr)
        return undefined;
    }
  } else {
    ptr = nameOrValue;
  }

  // final position of ptr should be the resolved value
  return ptr;
};

/**
 * Capitalize a string.
 */
Iron.utils.capitalize = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1, str.length);
};

/**
 * Convert a string to class case.
 */
Iron.utils.classCase = function (str) {
  const re = /_|-|\.|\//;

  if (!str)
    return '';

  return str.split(re).map((word) => {
    return Iron.utils.capitalize(word);
  }).join('');
};

/**
 * Convert a string to camel case.
 */
Iron.utils.camelCase = function (str) {
  const output = Iron.utils.classCase(str);
  return output.charAt(0).toLowerCase() + output.slice(1, output.length);
};

/**
 * deprecatation notice to the user which can be a string or object
 * of the form:
 *
 * {
 *  name: 'somePropertyOrMethod',
 *  where: 'RouteController',
 *  instead: 'someOtherPropertyOrMethod',
 *  message: ':name is deprecated. Please use :instead instead'
 * }
 */
Iron.utils.notifyDeprecated = function (info) {
  let name;
  let instead;
  let message;
  let where;
  const defaultMessage = "[:where] ':name' is deprecated. Please use ':instead' instead.";

  if (typeof info === 'object' && info !== null) {
    name = info.name;
    instead = info.instead;
    message = info.message || defaultMessage;
    where = info.where || 'IronRouter';
  } else {
    message = info;
    name = '';
    instead = '';
    where = '';
  }

  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      '<deprecated> ' +
      message
      .replace(':name', name)
      .replace(':instead', instead)
      .replace(':where', where) +
      ' ' +
      (new Error).stack
    );
  }
};

Iron.utils.withDeprecatedNotice = function (info, fn, thisArg) {
  return function () {
    Iron.utils.notifyDeprecated(info);
    return fn && fn.apply(thisArg || this, arguments);
  };
};

// so we can do this:
//   getController: function () {
//    ...
//   }.deprecate({...})
Function.prototype.deprecate = function (info) {
  return Iron.utils.withDeprecatedNotice(info, this);
};

/**
 * Returns a function that can be used to log debug messages for a given
 * package.
 */
Iron.utils.debug = function (packageName) {
  Iron.utils.assert(typeof packageName === 'string', "debug requires a package name");

  return function debug (/* args */) {
    if (console && console.log && Iron.debug === true) {
      const msg = Array.from(arguments).join(' ');
      console.log("%c<" + packageName + "> %c" + msg, "color: #999;", "color: #000;");
    }
  };
};

/*
 * Meteor's version of this function is broke.
 */
Iron.utils.get = function (obj /*, arguments */) {
  for (let i = 1; i < arguments.length; i++) {
    if (!obj || !(arguments[i] in obj))
      return undefined;
    obj = obj[arguments[i]];
  }
  return obj;
};

// make sure Iron ends up in the global namespace
Iron.utils.global.Iron = Iron;

export { Iron };
