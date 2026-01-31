/**
 * Type declaration for meteor/jquery module.
 * This is a separate file to ensure reliable module resolution.
 */

// Minimal JQueryStatic interface if @types/jquery is not available
interface JQueryStatic {
  (selector: string | Element | Document | Window): JQuery;
  (element: Element): JQuery;
  (elementArray: Element[]): JQuery;
  (callback: (jQueryAlias?: JQueryStatic) => any): JQuery;
  (object: {}): JQuery;
  (html: string, ownerDocument?: Document): JQuery;
  (html: string, attributes: Object): JQuery;
  (): JQuery;

  ajax(settings: any): any;
  ajax(url: string, settings?: any): any;
  param(obj: any): string;
  extend(target: any, ...sources: any[]): any;
  each(collection: any, callback: (indexInArray: number, valueOfElement: any) => any): any;
}

interface JQuery {
  [index: number]: HTMLElement;
  length: number;

  // Common methods
  on(events: string, handler: (eventObject: JQueryEventObject) => any): JQuery;
  on(events: string, selector: string, handler: (eventObject: JQueryEventObject) => any): JQuery;
  off(events?: string, selector?: string, handler?: (eventObject: JQueryEventObject) => any): JQuery;
  click(handler?: (eventObject: JQueryEventObject) => any): JQuery;
  find(selector: string): JQuery;
  closest(selector: string): JQuery;
  parent(selector?: string): JQuery;
  parents(selector?: string): JQuery;
  children(selector?: string): JQuery;
  attr(attributeName: string): string;
  attr(attributeName: string, value: string | number): JQuery;
  data(key: string): any;
  data(key: string, value: any): JQuery;
  val(): any;
  val(value: string | number | string[]): JQuery;
  html(): string;
  html(htmlString: string): JQuery;
  text(): string;
  text(text: string | number | boolean): JQuery;
  addClass(className: string): JQuery;
  removeClass(className?: string): JQuery;
  hasClass(className: string): boolean;
  css(propertyName: string): string;
  css(propertyName: string, value: string | number): JQuery;
  css(properties: Object): JQuery;
  show(): JQuery;
  hide(): JQuery;
  toggle(): JQuery;
  append(content: JQuery | Element | string): JQuery;
  prepend(content: JQuery | Element | string): JQuery;
  remove(selector?: string): JQuery;
  empty(): JQuery;
  eq(index: number): JQuery;
  first(): JQuery;
  last(): JQuery;
  get(index?: number): HTMLElement | HTMLElement[];
  each(func: (index: number, elem: Element) => any): JQuery;
  scrollTop(): number;
  scrollTop(value: number): JQuery;
}

interface JQueryEventObject extends Event {
  currentTarget: Element;
  delegateTarget: Element;
  data: any;
  isDefaultPrevented(): boolean;
  isImmediatePropagationStopped(): boolean;
  isPropagationStopped(): boolean;
  namespace: string;
  originalEvent: Event;
  pageX: number;
  pageY: number;
  result: any;
  target: Element;
  which: number;
}

declare module 'meteor/jquery' {
  const $: JQueryStatic;
  const jQuery: JQueryStatic;
  export { $, jQuery };
}
