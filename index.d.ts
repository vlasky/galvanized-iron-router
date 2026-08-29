// Type definitions for galvanized-iron-router
// Meteor routing package for client and server

/// <reference types="meteor" />

import { Meteor } from 'meteor/meteor';
import { Blaze } from 'meteor/blaze';
import { ReactiveDict } from 'meteor/reactive-dict';
import { Tracker } from 'meteor/tracker';

declare module 'meteor/vlasky:galvanized-iron-router' {
  // The exported Router is a callable router instance (usable as connect
  // middleware), not the Router class. The class itself is Iron.Router.
  export const Router: RouterGlobal;
  export const DEFAULT_REGION: string;
  export {
    RouteController,
    Iron,
    Route,
    Controller,
    Layout,
    DynamicTemplate,
    MiddlewareStack,
    Handler,
    Url,
    RC,
    // Client-only exports: present in the client entry module only. The
    // server entry does not export these (WaitList, Location, State and the
    // hash-style url helpers are client-side concepts).
    WaitList,
    Location,
    State,
    urlToHashStyle,
    urlFromHashStyle,
    fixHashPath,
  };
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
    ControllerParams,
    QueryParams,
    HttpMethod,
    ParsedUrl,
    RegionTemplate,
    SubscriptionHandleWithWait,
    DynamicTemplateOptions,
  };
}

// HTTP methods the router wires verb handlers for (Route#get, Route#post, ...)
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

// Route parameter types
interface RouteParams {
  [key: string]: string | undefined;
}

interface QueryParams {
  [key: string]: string | string[] | undefined;
}

/**
 * Parsed route/controller parameters: an array of positional match groups
 * that also carries the named parameters as properties, plus the parsed
 * query object and hash fragment (e.g. this.params.id, this.params.query.q,
 * this.params.hash).
 */
interface ControllerParams extends Array<any> {
  [key: string]: any;
  query: QueryParams;
  hash: string | null;
}

// Hook options for filtering routes
interface HookOptions {
  only?: string | string[];
  except?: string | string[];
}

// Options for inserting views into the DOM. `el` accepts a CSS selector, an
// element, or an array-like wrapper of elements (e.g. a jQuery collection).
interface InsertOptions {
  el?: string | HTMLElement | ArrayLike<HTMLElement>;
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
  data?: ((this: RouteController) => any) | object;
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

// Async hook function signature (for action methods that can be async)
// Allow boolean return for early exit patterns (return false to stop)
type AsyncHookFunction = (this: RouteController, ...args: any[]) => void | boolean | Promise<void>;

// RouteController.extend() props interface
interface RouteControllerExtendProps {
  // Template and layout
  template?: string;
  layoutTemplate?: string;
  loadingTemplate?: string;
  notFoundTemplate?: string;

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

  // Action (can be async)
  action?: AsyncHookFunction;

  // Data context
  data?: (this: RouteController) => any;

  // Region templates
  yieldRegions?: { [region: string]: RegionTemplate };
  yieldTemplates?: { [region: string]: RegionTemplate };
  regionTemplates?: { [region: string]: RegionTemplate };

  // Allow arbitrary additional methods/properties
  [key: string]: any;
}

// Route options interface
interface RouteOptions {
  path?: string;
  name?: string;
  template?: string;
  action?: (this: RouteController) => void;
  controller?: typeof RouteController | string;
  layoutTemplate?: string;
  where?: 'client' | 'server';
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
  params(path: string): ControllerParams;

  /** Find the controller constructor for this route */
  findControllerConstructor(): typeof RouteController;

  /** Create a controller instance for this route */
  createController(options?: object): RouteController;

  /** Dispatch this route */
  dispatch(url: string, context: object, done?: () => void): any;

  /** Set controller parameters from URL */
  setControllerParams(controller: RouteController, url: string): void;

  // HTTP method handlers (chainable). There is no options() verb; the
  // supported verbs are exactly those in HttpMethod.
  get(fn: Function): Route;
  post(fn: Function): Route;
  put(fn: Function): Route;
  delete(fn: Function): Route;
  patch(fn: Function): Route;
  head(fn: Function): Route;

  // Properties
  readonly name: string;
  options: RouteOptions;
  router: Router;
  handler: Handler;

  // Internal properties
  _path: string | RegExp;
  _methods: { [key: string]: Function };
  _actionStack: MiddlewareStack;
  _beforeStack: MiddlewareStack;
  _afterStack: MiddlewareStack;
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

  /** Initialize the controller */
  init(options?: ControllerOptions): void;

  /** Set the layout template */
  layout(template: string, options?: LayoutOptions): { data(value: (() => any) | object): void };

  /** Render a template to a region (no args uses the default template) */
  render(template?: string, options?: RenderOptions): { data(value: (() => any) | object): void };

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
  static _name?: string;
  static _helpers?: { [key: string]: Function };
  static __super__?: any;

  // Properties
  _layout: Layout;
  options: ControllerOptions;
  state?: ReactiveDict;
  _waitlist?: WaitList;
  _isController: boolean;
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
  getParams(): ControllerParams;

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
  static extend(props: RouteControllerExtendProps): typeof RouteController;
  static events(events: { [key: string]: Function }): typeof RouteController;
  static helpers(helpers: { [key: string]: Function }): typeof RouteController;

  // Properties
  router: Router;
  route: Route;
  state: ReactiveDict;
  params: ControllerParams;
  url: string;
  originalUrl: string;
  method: HttpMethod;

  // Client-side only
  location?: LocationAPI;

  // Server-side only
  request?: Express.Request;
  response?: Express.Response;

  // Allow arbitrary custom properties (controllers commonly store state on this)
  [key: string]: any;
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

/** The name of the default (main) layout region. Also Layout.DEFAULT_REGION. */
declare const DEFAULT_REGION: string;

// Middleware Handler
declare class Handler {
  constructor(path: string | RegExp | Function, fn?: Function | object, options?: object);
  name?: string;
  path: string | RegExp;
  handle: Function;
  options: object;
  mount?: boolean;
  method?: string | boolean;
  where?: string;
  test(path: string): boolean;
  params(path: string): ControllerParams;
  resolve(params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;
  clone(): Handler;
}

// Options accepted when adding a handler to a MiddlewareStack
interface HandlerOptions {
  name?: string;
  mount?: boolean;
  where?: 'client' | 'server';
  method?: string;
  [key: string]: any;
}

// MiddlewareStack class
declare class MiddlewareStack {
  constructor();

  /** Push a handler onto the stack (the path defaults to "/") */
  push(fn: Function, options?: HandlerOptions): Handler;
  push(path: string | RegExp, fn: Function | string | object, options?: HandlerOptions): Handler;

  /** Append handlers to the stack */
  append(...fns: any[]): MiddlewareStack;

  /** Insert a handler at a specific index */
  insertAt(index: number, fn: Function, options?: HandlerOptions): MiddlewareStack;
  insertAt(index: number, path: string | RegExp, fn: Function, options?: HandlerOptions): MiddlewareStack;

  /** Insert a handler before a named handler */
  insertBefore(name: string, fn: Function, options?: HandlerOptions): MiddlewareStack;
  insertBefore(name: string, path: string | RegExp, fn: Function, options?: HandlerOptions): MiddlewareStack;

  /** Insert a handler after a named handler */
  insertAfter(name: string, fn: Function, options?: HandlerOptions): MiddlewareStack;
  insertAfter(name: string, path: string | RegExp, fn: Function, options?: HandlerOptions): MiddlewareStack;

  /** Find a handler by name */
  findByName(name: string): Handler | undefined;

  /** Concatenate middleware stacks */
  concat(...stacks: MiddlewareStack[]): MiddlewareStack;

  /** Dispatch a request through the stack */
  dispatch(url: string, context: object, done?: (err?: any) => void): any;

  /**
   * Register a callback invoked when a client dispatch hits a server-only
   * handler. The callback receives the dispatch context as `this`.
   */
  onServerDispatch(callback: (this: object, handler: Handler, url: string) => void): MiddlewareStack;

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

// URL class
declare class Url {
  constructor(url: string | RegExp, options?: object);

  /** Test if a path matches this URL pattern */
  test(path: string): boolean;

  /** Execute regex match on path */
  exec(path: string): RegExpExecArray | null;

  /** Extract parameters from path */
  params(path: string): ControllerParams;

  /** Resolve URL with parameters */
  resolve(params?: RouteParams, options?: { query?: QueryParams; hash?: string; throwOnMissingParams?: boolean }): string | null;

  // Static methods
  static normalize(url: string | RegExp): string | RegExp;
  static isSameOrigin(a: string, b: string): boolean;
  static parse(url: string): ParsedUrl;
  static fromQueryString(query: string): QueryParams;
  static toQueryString(queryObject: QueryParams | string | null): string;
}

// Client-side Location state
declare class State implements ParsedUrl {
  constructor(url: string, options?: { historyState?: any });
  options: { historyState?: any };
  equals(other: State | null | undefined): boolean;
  isCancelled(): boolean;
  cancelUrlChange(): void;
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

interface LocationAPI {
  options: Iron.Location.LocationOptions;
  configure(options: Iron.Location.LocationOptions): void;
  get(): State;
  go(url: string, options?: { replaceState?: boolean; historyState?: any }): void;
  start(): void;
  stop(): void;
  onClick(fn: (event: MouseEvent) => void): void;
  /** The callback receives the new state as `this` (no arguments are passed) */
  onGo(cb: (this: State) => void): void;
  /** The callback receives the new state as `this` (no arguments are passed) */
  onPopState(cb: (this: State) => void): void;
}

declare const Location: LocationAPI;

declare function urlToHashStyle(url: string): string;
declare function urlFromHashStyle(url: string): string;
declare function fixHashPath(pathname: string): string;

// File-scoped aliases so declarations inside `namespace Iron` and
// `declare global` can reference the classes above without the names
// resolving circularly to themselves.
type ControllerClass = typeof Controller;
type RouteControllerClass = typeof RouteController;
type RouteClass = typeof Route;
type HandlerClass = typeof Handler;
type LayoutClass = typeof Layout;
type DynamicTemplateClass = typeof DynamicTemplate;
type MiddlewareStackClass = typeof MiddlewareStack;
type WaitListClass = typeof WaitList;
type UrlClass = typeof Url;

// Iron namespace
declare namespace Iron {
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
    /** The callback receives the new state as `this` (no arguments are passed) */
    function onGo(cb: (this: State) => void): void;
    /** The callback receives the new state as `this` (no arguments are passed) */
    function onPopState(cb: (this: State) => void): void;
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

  // The current route controller (reactive; template helper support)
  function controller(): RouteController | null;

  // Class exports (the constructors themselves)
  const Url: UrlClass;
  const Controller: ControllerClass;
  const RouteController: RouteControllerClass;
  const Route: RouteClass;
  const Handler: HandlerClass;
  const Layout: LayoutClass;
  const DynamicTemplate: DynamicTemplateClass;
  const MiddlewareStack: MiddlewareStackClass;
  const WaitList: WaitListClass;

  // The Router class (constructing one returns a callable router instance).
  // Class-level configuration such as Router.hooks, Router.plugins and
  // Router.bodyParser lives here, not on the global router instance.
  const Router: RouterConstructor;
}

/**
 * A router instance: a callable connect-style middleware function carrying
 * all router methods. The package's exported `Router` (and the `Router`
 * global) is one of these, not the class; the class is `Iron.Router`.
 */
interface Router {
  /** Routers are usable directly as connect-style middleware */
  (req: Express.Request, res: Express.Response, next?: (err?: any) => void): void;

  /** Configure the router */
  configure(options: RouterOptions): Router;

  /** Map routes using a function */
  map(fn: (this: Router) => void): any;

  /** Register a plugin */
  plugin(nameOrFn: string | ((router: Router, options?: object) => void), options?: object): Router;

  /** Initialize the router */
  init(options?: RouterOptions): void;

  /** Start the router */
  start(): void;

  /** Stop the router */
  stop(): void;

  /** Define a route */
  route(path: string | RegExp, fn?: string | ((this: RouteController) => void) | RouteOptions, opts?: RouteOptions): Route;

  /** Find the first matching route for a URL */
  findFirstRoute(url: string): Route | null;

  /**
   * Look up a route by name. Safe for any route name, including ones that
   * collide with Array members (a route at /push or /length), which the
   * legacy Router.routes.someName alias cannot express.
   */
  findRouteByName(name: string): Route | undefined;

  /** Get the path for a named route */
  path(routeName: string, params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;

  /** Get the full URL for a named route */
  url(routeName: string, params?: RouteParams, options?: { query?: QueryParams; hash?: string }): string | null;

  /** Create a controller for a URL */
  createController(url: string, context?: object): RouteController;

  /** Register a controller */
  registerController(nameOrController: string | typeof RouteController, controller?: typeof RouteController): Router;

  /** Register multiple controllers */
  registerControllers(controllers: (typeof RouteController)[] | { [name: string]: typeof RouteController }): Router;

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

  /** Dispatch a URL. Returns the new controller on the client, nothing on the server */
  dispatch(url: string, context?: object, done?: (err?: any) => void): RouteController | void;

  /** Insert the router view into the DOM (client-side) */
  insert(options?: InsertOptions): Router;

  /** Create the router view (client-side) */
  createView(): Blaze.View;

  // Properties
  /**
   * All routes in definition order. Also carries a legacy name => route
   * alias for names that don't collide with Array members; prefer
   * findRouteByName() for lookups.
   */
  routes: Route[] & { [name: string]: Route | undefined };
  options: RouterOptions;

  // Internal properties
  _currentController: RouteController | null;
  _currentRoute: Route | null;
  _currentDep: Tracker.Dependency;
  _layout: Layout;
  _stack: MiddlewareStack;
  _globalHooks: { [type: string]: HookFunction[] };
  _locationComputation: Tracker.Computation | null;
  _controllers: { [name: string]: typeof RouteController };
}

/**
 * The Router class (Iron.Router). Class-level hooks, plugins and the body
 * parser factory live here as statics.
 */
interface RouterConstructor {
  new (options?: RouterOptions): Router;

  readonly HOOK_TYPES: string[];
  hooks: {
    loading: HookFunction;
    dataNotFound: HookFunction;
    [key: string]: HookFunction;
  };
  plugins: {
    loading: (router: Router, options?: object) => void;
    dataNotFound: (router: Router, options?: object) => void;
    [key: string]: (router: Router, options?: object) => void;
  };
  /** Body parser factory (server): json/urlencoded/text middleware creators */
  bodyParser: any;
}

type RouterGlobal = Router;
type IronNamespace = typeof Iron;

// Global router instance
declare const Router: Router;
declare const RC: RouteControllerClass;

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

// Global declarations (the package also exposes these as Meteor globals)
declare global {
  const Router: RouterGlobal;
  const Iron: IronNamespace;
  const RouteController: RouteControllerClass;
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
  Handler,
  Url,
  Location,
  State,
  Iron,
  RC,
  DEFAULT_REGION,
  urlToHashStyle,
  urlFromHashStyle,
  fixHashPath,
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
  ControllerParams,
  QueryParams,
  HttpMethod,
  ParsedUrl,
  RegionTemplate,
  SubscriptionHandleWithWait,
  DynamicTemplateOptions,
};
