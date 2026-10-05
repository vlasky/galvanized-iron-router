/**
 * Minimal declaration of the htmljs package, which @types/meteor does not
 * cover. Only what lib/router/helpers.js uses.
 *
 * This is deliberately a global script file (no imports or exports): an
 * ambient declaration of a module that has no existing types cannot live in a
 * module file such as meteor-augmentations.d.ts, where `declare module` only
 * augments.
 */
declare module 'meteor/htmljs' {
  namespace HTML {
    function Raw(html: string): any;
    function A(...args: any[]): any;
  }
}
