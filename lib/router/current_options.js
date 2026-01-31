import { Meteor } from 'meteor/meteor';

/**
 * Allows for dynamic scoping of options variables. Primarily intended to be
 * used in the RouteController.prototype.lookupOption method.
 */
const CurrentOptions = new Meteor.EnvironmentVariable;

export { CurrentOptions };
