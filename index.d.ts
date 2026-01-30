// Type definitions for galvanized-iron-router
// Meteor routing package for client and server

/// <reference types="meteor" />

import { Meteor } from 'meteor/meteor';
import { Blaze } from 'meteor/blaze';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Tracker } from 'meteor/tracker';
import { Mongo } from 'meteor/mongo';

declare module 'meteor/vlasky:galvanized-iron-router' {
  export { Router, RouteController, Iron };
  export {
    RouterOptions,
    RouteOptions,
    ControllerOptions,
    HookOptions,
    HookFunction,
    RenderOptions,
    LayoutOptions,
    InsertOptions,
    RouteParams,
    QueryParams,
    HttpMethod,
    ParsedUrl,
    RegionTemplate,
    SubscriptionHandleWithWait,
    Handler,
    DynamicTemplateOptions,
  };
}

// HTTP method types
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// Route parameter types
interface RouteParams {
  [key: string]: string | undefined;
}

interface QueryParams {
  [key: string]: string | string[] | undefined;
}

// Hook options for filtering routes
interface HookOptions {
  only?: string | string[];
  except?: string | string[];
}

// Options for inserting views into the DOM
interface InsertOptions {
  el?: string | HTMLElement;
  nextNode?: Node;
  parentView?: Blaze.View;
}

// Layout rendering options
interface LayoutOptions {
  data?: (() => any) | object;
}

// Render options for templates
interface RenderOptions {
  to?: string;
  region?: string;
  data?: (() => any) | object;
}

// Region template configuration
interface RegionTemplate {
  to?: string;
  data?: (() => any) | object;
}

// Subscription handle with wait capability
interface SubscriptionHandleWithWait extends Meteor.SubscriptionHandle {
  wait(): void;
}

// Hook function signature
type HookFunction = (this: RouteController, ...args: any[]) => void;

// Route options interface
interface RouteOptions {
  path?: string;
  name?: string;
  template?: string;
  action?: (this: RouteController) => void;
  controller?: typeof RouteController | string;
  layoutTemplate?: string;
  where?: 'client' | 'server' | 'both';
  method?: HttpMethod | HttpMethod[];
  mount?: boolean;

  // Hooks
  onRun?: HookFunction | HookFunction[];
  onRerun?: HookFunction | HookFunction[];
  onBeforeAction?: HookFunction | HookFunction[];
  onAfterAction?: HookFunction | HookFunction[];
  onStop?: HookFunction | HookFunction[];
  waitOn?: HookFunction | HookFunction[];
  subscriptions?: HookFunction | HookFunction[];

  // Legacy hook aliases
  load?: HookFunction | HookFunction[];
  before?: HookFunction | HookFunction[];
  after?: HookFunction | HookFunction[];
  unload?: HookFunction | HookFunction[];

  // Data context
  data?: (() => any) | object;

  // Region templates
  yieldRegions?: { [region: string]: RegionTemplate };
  yieldTemplates?: { [region: string]: RegionTemplate };
  regionTemplates?: { [region: string]: RegionTemplate };
}

// Router configuration options
interface RouterOptions extends RouteOptions {
  autoStart?: boolean;
  autoRender?: boolean;
  useHashPaths?: boolean;
  linkSelector?: string;
  notFoundTemplate?: string;
  noRoutesTemplate?: string;
  loadingTemplate?: string;
}

// Route class
declare class Route {
  constructor(path: string | RegExp, fn?: string | Function | RouteOptions, options?: RouteOptions);

  /** Get the route name */
  getName(): string;

  /** Get the path with parameters substituted */
  path(params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string;

  /** Get the full URL with parameters substituted */
  url(params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string;

  /** Extract parameters from a path */
  params(path: string): any[];

  /** Find the controller constructor for this route */
  findControllerConstructor(): typeof RouteController;

  /** Create a controller instance for this route */
  createController(options?: object): RouteController;

  /** Dispatch this route */
  dispatch(url: string, context: object, done?: () => void): any;

  /** Set controller parameters from URL */
  setControllerParams(controller: RouteController, url: string): void;

  // HTTP method handlers (chainable)
  get(fn: Function): Route;
  post(fn: Function): Route;
  put(fn: Function): Route;
  delete(fn: Function): Route;
  patch(fn: Function): Route;
  head(fn: Function): Route;
  options(fn: Function): Route;

  // Properties
  readonly name: string;
  readonly options: RouteOptions;
}

// Controller options
interface ControllerOptions {
  route?: Route;
  layout?: Layout;
  template?: string;
  data?: (() => any) | object;
  [key: string]: any;
}

// WaitList class for subscription management
declare class WaitList {
  constructor();

  /** Add a function or subscription to wait for */
  wait(fn: Function | Meteor.SubscriptionHandle | { ready(): boolean }): void;

  /** Check if all items are ready */
  ready(): boolean;

  /** Stop all tracked items */
  stop(): void;
}

// Base Controller class
declare class Controller {
  constructor(options?: ControllerOptions);

  /** Set the layout template */
  layout(template: string, options?: LayoutOptions): { data(value: (() => any) | object): void };

  /** Render a template to a region */
  render(template: string, options?: RenderOptions): { data(value: (() => any) | object): void };

  /** Begin rendering transaction */
  beginRendering(onComplete?: () => void): void;

  /** Insert the controller view into the DOM */
  insert(options?: InsertOptions): Controller;

  /** Stop the controller */
  stop(): void;

  // Static methods for inheritance
  static extend(props: object): typeof Controller;
  static events(events: { [key: string]: Function }): typeof Controller;
  static helpers(helpers: { [key: string]: Function }): typeof Controller;

  // Properties
  _layout: Layout;
  options: ControllerOptions;
  state?: ReactiveDict;
  _waitlist?: WaitList;
}

// RouteController class
declare class RouteController extends Controller {
  constructor(options?: ControllerOptions);

  /** Initialize the controller */
  init(options?: object): void;

  /** Configure controller from URL */
  configureFromUrl(url: string, context?: object, options?: object): void;

  /** Look up an option value */
  lookupOption(key: string): any;

  /** Get route parameters */
  getParams(): any[];

  /** Set route parameters */
  setParams(value: any[], options?: object): RouteController;

  /** Render all configured regions */
  renderRegions(): void;

  /** Subscribe to a publication with optional wait */
  subscribe(name: string, ...args: any[]): SubscriptionHandleWithWait;

  /** Add items to wait list */
  wait(fn: Function | Function[] | Meteor.SubscriptionHandle | { ready(): boolean }): RouteController;

  /** Check if all subscriptions are ready */
  ready(): boolean;

  /** Stop the controller and clean up */
  stop(): void;

  /** Redirect to another route or URL */
  redirect(routeNameOrPath: string, params?: RouteParams, options?: object): void;

  /** Look up the template name */
  lookupTemplate(): string;

  /** Look up region templates configuration */
  lookupRegionTemplates(): { [key: string]: any };

  /** Get data context (if data function defined) */
  data?(): any;

  /** Continue to next middleware/hook */
  next(): void;

  // Static methods
  static extend(props: object): typeof RouteController;
  static events(events: { [key: string]: Function }): typeof RouteController;
  static helpers(helpers: { [key: string]: Function }): typeof RouteController;

  // Properties
  router: Router;
  route: Route;
  state: ReactiveDict;
  params: RouteParams & any[];
  url: string;
  originalUrl: string;
  method: HttpMethod;

  // Client-side only
  location?: Iron.Location.State;

  // Server-side only
  request?: Express.Request;
  response?: Express.Response;
}

// DynamicTemplate options
interface DynamicTemplateOptions {
  template?: string | (() => string);
  defaultTemplate?: string;
  data?: (() => any) | object;
}

// DynamicTemplate class
declare class DynamicTemplate {
  constructor(options?: DynamicTemplateOptions);

  /** Get or set the template */
  template(value?: string | (() => string)): string | void;

  /** Get or set the default template */
  defaultTemplate(value?: string): string | void;

  /** Get or set the data context */
  data(value?: (() => any) | object): any | void;

  /** Clear the template */
  clear(): void;

  /** Create the Blaze view */
  create(options?: object): Blaze.View;

  /** Destroy the view */
  destroy(): void;

  /** Insert into the DOM */
  insert(options?: InsertOptions): DynamicTemplate;

  /** Register view created callback */
  onViewCreated(cb: (view: Blaze.View) => void): DynamicTemplate;

  /** Register view ready callback */
  onViewReady(cb: (view: Blaze.View) => void): DynamicTemplate;

  /** Register view destroyed callback */
  onViewDestroyed(cb: (view: Blaze.View) => void): DynamicTemplate;

  /** Set up event handlers */
  events(eventMap: { [key: string]: Function }, thisInHandler?: any): void;

  // Static methods
  static extend(props: object): typeof DynamicTemplate;
  static getParentDataContext(view: Blaze.View): any;
  static getDataContext(view: Blaze.View): any;
  static getInclusionArguments(view: Blaze.View): any;
  static args(view: Blaze.View): () => any;
  static findFirstLookupHost(view: Blaze.View): any;
  static findLookupHostWithProperty(view: Blaze.View, key: string): any;
  static findLookupHostWithHelper(view: Blaze.View, helperKey: string): any;

  // Properties
  readonly isCreated: boolean;
  readonly isDestroyed: boolean;
  readonly view: Blaze.View;
  readonly _id: string;
}

// Layout class
declare class Layout extends DynamicTemplate {
  constructor(options?: DynamicTemplateOptions);

  /** Get a region by name */
  region(name: string, options?: object): DynamicTemplate;

  /** Check if a region exists and has content */
  has(region?: string): boolean;

  /** Get all region names */
  regionKeys(): string[];

  /** Render a template to a region */
  render(template: string, options?: RenderOptions): void;

  /** Clear a specific region or main region */
  clear(region?: string): Layout;

  /** Clear all regions */
  clearAll(): Layout;

  /** Destroy all regions */
  destroyRegions(): void;

  /** Begin rendering transaction */
  beginRendering(onComplete?: () => void): void;

  /** Register region created callback */
  onRegionCreated(cb: (region: DynamicTemplate) => void): Layout;

  /** Register region rendered callback */
  onRegionRendered(cb: (region: DynamicTemplate) => void): Layout;

  /** Register region destroyed callback */
  onRegionDestroyed(cb: (region: DynamicTemplate) => void): Layout;

  // Static properties
  static readonly DEFAULT_REGION: string;

  // Properties
  _regions: { [key: string]: DynamicTemplate };
}

// Middleware Handler
interface Handler {
  name?: string;
  path: string | RegExp;
  handle: Function;
  options: object;
  test(path: string): boolean;
  params(path: string): object;
}

// MiddlewareStack class
declare class MiddlewareStack {
  constructor();

  /** Push a handler onto the stack */
  push(path: string | RegExp, fn: Function, options?: { name?: string; mount?: boolean; where?: string }): Handler;

  /** Append handlers to the stack */
  append(...fns: any[]): MiddlewareStack;

  /** Insert a handler at a specific index */
  insertAt(index: number, path: string | RegExp, fn: Function, options?: object): MiddlewareStack;

  /** Insert a handler before a named handler */
  insertBefore(name: string, path: string | RegExp, fn: Function, options?: object): MiddlewareStack;

  /** Insert a handler after a named handler */
  insertAfter(name: string, path: string | RegExp, fn: Function, options?: object): MiddlewareStack;

  /** Find a handler by name */
  findByName(name: string): Handler | undefined;

  /** Concatenate middleware stacks */
  concat(...stacks: MiddlewareStack[]): MiddlewareStack;

  /** Dispatch a request through the stack */
  dispatch(url: string, context: object, done?: () => void): any;

  // Properties
  readonly length: number;
}

// Parsed URL structure
interface ParsedUrl {
  rootUrl: string;
  originalUrl: string;
  href: string;
  protocol: string;
  auth: string;
  host: string;
  hostname: string;
  port: string;
  origin: string;
  path: string;
  pathname: string;
  search: string;
  query: string;
  queryObject: QueryParams;
  hash: string;
  slashes: boolean;
}

// Iron namespace
declare namespace Iron {
  // URL class
  class Url {
    constructor(url: string, options?: object);

    /** Test if a path matches this URL pattern */
    test(path: string): boolean;

    /** Execute regex match on path */
    exec(path: string): RegExpExecArray | null;

    /** Extract parameters from path */
    params(path: string): any[];

    /** Resolve URL with parameters */
    resolve(params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;

    // Static methods
    static normalize(url: string | RegExp): string | RegExp;
    static isSameOrigin(a: string, b: string): boolean;
    static parse(url: string): ParsedUrl;
    static fromQueryString(query: string): QueryParams;
    static toQueryString(queryObject: QueryParams | string): string;
  }

  // Location module (client-side)
  namespace Location {
    interface State extends ParsedUrl {
      options: { historyState?: any };
      equals(other: State): boolean;
      isCancelled(): boolean;
      cancelUrlChange(): void;
    }

    interface LocationOptions {
      linkSelector?: string;
      useHashPaths?: boolean;
    }

    const options: LocationOptions;
    function configure(options: LocationOptions): void;
    function get(): State;
    function go(url: string, options?: { replaceState?: boolean; historyState?: any }): void;
    function start(): void;
    function stop(): void;
    function onClick(fn: (event: MouseEvent) => void): void;
    function onGo(cb: (state: State) => void): void;
    function onPopState(cb: (state: State) => void): void;
  }

  // Utilities
  namespace utils {
    function assert(condition: boolean, msg: string): void;
    function warn(condition: boolean, msg: string): void;
    function defaultValue<T>(target: object, prop: string, value: T): T;
    function inherits<T extends Function>(Child: T, Parent: Function, props?: object): T;
    function extend<T extends Function>(Parent: T, props?: object): T;
    function namespace(namespace: string, value?: any): any | void;
    function resolve(nameOrValue: string | any): any;
    function capitalize(str: string): string;
    function classCase(str: string): string;
    function camelCase(str: string): string;
    function debug(pkg: string): (...args: any[]) => void;
    function get(obj: object, ...path: string[]): any;
    function notifyDeprecated(info: string | object): void;
    function withDeprecatedNotice<T extends Function>(info: object, fn: T, thisArg?: any): T;
    const global: typeof globalThis;
  }

  // Class system
  function Class(definition?: object): typeof Controller;

  // Controller reference (template helper)
  function controller(): RouteController | null;

  // Layout class export
  const Layout: typeof globalThis.Layout;

  // DynamicTemplate class export
  const DynamicTemplate: typeof globalThis.DynamicTemplate;

  // MiddlewareStack class export
  const MiddlewareStack: typeof globalThis.MiddlewareStack;

  // Router class export
  const Router: typeof globalThis.Router;

  // RouteController class export
  const RouteController: typeof globalThis.RouteController;

  // WaitList class export
  const WaitList: typeof globalThis.WaitList;
}

// Router class
declare class Router {
  constructor(options?: RouterOptions);

  /** Configure the router */
  configure(options: RouterOptions): Router;

  /** Map routes using a function */
  map(fn: (this: Router) => void): any;

  /** Register a plugin */
  plugin(nameOrFn: string | ((router: Router, options?: object) => void), options?: object): Router;

  /** Initialize the router */
  init(options?: RouterOptions): void;

  /** Start the router (client-side) */
  start(): void;

  /** Stop the router */
  stop(): void;

  /** Define a route */
  route(path: string | RegExp, fn?: string | Function | RouteOptions, opts?: RouteOptions): Route;

  /** Find the first matching route for a URL */
  findFirstRoute(url: string): Route | null;

  /** Get the path for a named route */
  path(routeName: string, params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;

  /** Get the full URL for a named route */
  url(routeName: string, params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;

  /** Create a controller for a URL */
  createController(url: string, context?: object): RouteController;

  /** Register a controller */
  registerController(nameOrController: string | typeof RouteController, controller?: typeof RouteController): Router;

  /** Register multiple controllers */
  registerControllers(controllers: (typeof RouteController)[]): Router;

  /** Get a registered controller by name */
  getController(name: string): typeof RouteController | undefined;

  /** Set template name converter function */
  setTemplateNameConverter(fn: (str: string) => string): Router;

  /** Set controller name converter function */
  setControllerNameConverter(fn: (str: string) => string): Router;

  /** Convert string to template name */
  toTemplateName(str: string): string;

  /** Convert string to controller name */
  toControllerName(str: string): string;

  /** Add a hook */
  addHook(type: string, hook: HookFunction | string, options?: HookOptions): Router;

  /** Get hooks by type and optionally by name */
  getHooks(type: string, name?: string): HookFunction[];

  /** Look up a hook by name or return function */
  lookupHook(nameOrFn: HookFunction | string): HookFunction;

  // Hook registration methods (chainable)
  onRun(hook: HookFunction | string, options?: HookOptions): Router;
  onRerun(hook: HookFunction | string, options?: HookOptions): Router;
  onBeforeAction(hook: HookFunction | string, options?: HookOptions): Router;
  onAfterAction(hook: HookFunction | string, options?: HookOptions): Router;
  onStop(hook: HookFunction | string, options?: HookOptions): Router;
  waitOn(hook: HookFunction | string, options?: HookOptions): Router;
  subscriptions(hook: HookFunction | string, options?: HookOptions): Router;

  /** Navigate to a route or URL */
  go(routeNameOrPath: string, params?: RouteParams, options?: { query?: QueryParams; hash?: string; replaceState?: boolean }): void;

  /** Get the current controller */
  current(): RouteController | null;

  /** Dispatch a URL */
  dispatch(url: string, context?: object, done?: () => void): RouteController;

  /** Insert the router view into the DOM (client-side) */
  insert(options?: InsertOptions): Router;

  /** Create the router view (client-side) */
  createView(): Blaze.View;

  // Static properties
  static readonly HOOK_TYPES: string[];
  static readonly hooks: {
    loading: HookFunction;
    dataNotFound: HookFunction;
    [key: string]: HookFunction;
  };
  static readonly plugins: {
    loading: (router: Router, options?: object) => void;
    dataNotFound: (router: Router, options?: object) => void;
    [key: string]: (router: Router, options?: object) => void;
  };

  // Properties
  routes: Route[];
  options: RouterOptions;
}

// Global Router instance
declare const Router: Router & typeof Router;

// Express types for server-side request/response
declare namespace Express {
  interface Request {
    url: string;
    originalUrl: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
    query: QueryParams;
    params: RouteParams;
    body?: any;
    [key: string]: any;
  }

  interface Response {
    statusCode: number;
    setHeader(name: string, value: string | number | readonly string[]): Response;
    getHeader(name: string): string | number | string[] | undefined;
    removeHeader(name: string): void;
    write(chunk: any, encoding?: string): boolean;
    end(data?: any, encoding?: string): Response;
    send(body?: any): Response;
    json(body?: any): Response;
    redirect(url: string): void;
    redirect(status: number, url: string): void;
    [key: string]: any;
  }
}

// Global declarations
declare global {
  const Router: Router & typeof Router;
  const Iron: typeof Iron;
  const RouteController: typeof RouteController;

  // Blaze template helpers
  namespace Blaze {
    interface TemplateInstance {
      /** Get the current route controller */
      controller(): RouteController | null;
    }
  }
}

export {
  Router,
  RouteController,
  Route,
  Controller,
  Layout,
  DynamicTemplate,
  MiddlewareStack,
  WaitList,
  Iron,
  // Type exports
  RouterOptions,
  RouteOptions,
  ControllerOptions,
  HookOptions,
  HookFunction,
  RenderOptions,
  LayoutOptions,
  InsertOptions,
  RouteParams,
  QueryParams,
  HttpMethod,
  ParsedUrl,
  RegionTemplate,
  SubscriptionHandleWithWait,
  Handler,
  DynamicTemplateOptions,
};
