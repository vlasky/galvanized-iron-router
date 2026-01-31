/**
 * Type augmentations for internal Meteor/Blaze APIs used by galvanized-iron-router.
 * These extend the @types/meteor definitions with internal APIs not in the public types.
 */

import 'meteor/blaze';
import 'meteor/webapp';
import 'meteor/reactive-var';
import 'meteor/tracker';

// Augment Blaze with internal APIs
declare module 'meteor/blaze' {
  namespace Blaze {
    // Internal event support
    const _EventSupport: {
      listen(
        element: Element,
        events: string,
        selector: string,
        handler: (evt: Event) => any,
        range?: any,
        getParentRange?: (r: any) => any
      ): { stop(): void };
    };

    // Internal view utilities
    function _withCurrentView<T>(view: View, func: () => T): T;

    // UI.registerHelper (deprecated name, but still used)
    function registerHelper(name: string, helper: any): void;

    // View static (callable without new)
    interface ViewStatic {
      (name: string, renderFunc: () => any): View;
      new(name: string, renderFunc: () => any): View;
    }
    const View: ViewStatic;

    // View internal properties
    interface View {
      __dynamicTemplate__?: any;
      __isTemplateWith?: boolean;
      _scopeBindings?: Record<string, any>;
      _domrange?: DOMRange | null;
      _templateInstance?: TemplateInstance | null;
      _onViewRendered?: (fn: () => void) => void;
      onViewRendered(fn: () => void): void;
      dataVar?: {
        get(): any;
        set(value: any): void;
      };
      renderCount?: number;
      templateInstance(): TemplateInstance;
      autorun(func: (computation: Tracker.Computation) => void): Tracker.Computation;
      lookup(name: string): any;
      name?: string;
      parentView?: View | null;
      isCreated?: boolean;
      isRendered?: boolean;
      isDestroyed?: boolean;
    }

    // DOMRange internal type
    interface DOMRange {
      attached: boolean;
      parentElement: Element;
      firstNode(): Node;
      lastNode(): Node;
      containsElement(element: Element): boolean;
      onAttached(callback: (range: DOMRange, element: Element) => void): void;
    }

    // TemplateInstance constructor
    function TemplateInstance(view: View): TemplateInstance;
  }

  // HTML namespace for helpers.js
  namespace HTML {
    function Raw(html: string): any;
    function A(...args: any[]): any;
  }
}

// Augment ReactiveVar to be callable without 'new'
declare module 'meteor/reactive-var' {
  // ReactiveVar can be called with or without new in Meteor
  interface ReactiveVarStatic {
    <T>(initialValue?: T, equalsFunc?: (oldVal: T, newVal: T) => boolean): ReactiveVar<T>;
    new<T>(initialValue?: T, equalsFunc?: (oldVal: T, newVal: T) => boolean): ReactiveVar<T>;
  }
  const ReactiveVar: ReactiveVarStatic;
}

// Augment Tracker with internal Computation properties
declare module 'meteor/tracker' {
  namespace Tracker {
    interface Computation {
      _id: number;
      _parent: Computation | null;
    }
  }
}

// Augment WebApp for Meteor 3.0 Express integration
declare module 'meteor/webapp' {
  namespace WebApp {
    const express: {
      json(options?: any): any;
      urlencoded(options?: any): any;
      text(options?: any): any;
      raw(options?: any): any;
    } | undefined;
  }
}

// Augment Package for weak dependencies
declare module 'meteor/meteor' {
  namespace Meteor {
    /** Meteor 3.0+ flag indicating Fibers are disabled */
    const isFibersDisabled: boolean | undefined;
  }

  // Extend Package type
  interface Package {
    appcache?: any;
    reload?: {
      Reload: {
        _onMigrate(name: string, callback: () => [boolean, boolean]): void;
      };
    };
  }
}

// jQuery module declaration
declare module 'meteor/jquery' {
  const $: JQueryStatic;
  const jQuery: JQueryStatic;
  export { $, jQuery };
}

// Function prototype extension for deprecation
declare global {
  interface Function {
    __super__?: any;
    deprecate(info: { where: string; instead?: string; message?: string }): Function;
  }
}

export {};
