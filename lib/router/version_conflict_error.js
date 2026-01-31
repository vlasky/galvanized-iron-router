import { Meteor } from 'meteor/meteor';
// Access Package from global scope for weak dependency checking
const Package = /** @type {any} */ (globalThis.Package || {});

// Comprehensive conflict check for all Iron Router packages
Meteor.startup(() => {
  const installedConflicts = [];

  // Check for all conflicting Iron Router packages after all packages are loaded
  if (Package) {
    const conflictingPackages = [
      'iron:core', 'iron:router', 'iron:dynamic-template', 'iron:layout',
      'iron:controller', 'iron:location', 'iron:middleware-stack', 'iron:url',
      'cmather:iron-core', 'cmather:iron-router',
      'cmather:iron-dynamic-template', 'cmather:iron-dynamic-layout',
      'cmather:blaze-layout'
    ];

    // Find which specific packages are actually installed
    for (let i = 0; i < conflictingPackages.length; i++) {
      if (Package[conflictingPackages[i]]) {
        installedConflicts.push(conflictingPackages[i]);
      }
    }
  }

  // Build specific error message if conflicts found
  if (installedConflicts.length > 0) {
    const conflictMessage = "\n\n\
    Package conflict detected! You have old Iron Router packages installed alongside Galvanized Iron Router.\n\
    This causes version conflicts. Please remove these specific conflicting packages:\n\n\
    > meteor remove " + installedConflicts.join(' ') + "\n\
    \n\
    Galvanized Iron Router includes all functionality in a single package.\n\
    \n\n\
  ";

    throw new Error("Package conflicts detected with Galvanized Iron Router\n\n" + conflictMessage);
  }
});
