import { WebApp } from 'meteor/webapp';
import { Router } from './router.js';

// Conditional body parser for Meteor 3.0+ Express 5 compatibility
if (typeof WebApp !== 'undefined' && WebApp.express && typeof WebApp.express.json === 'function') {
  // Meteor 3.0+ with Express 5 - use built-in Express body parsing
  Router.bodyParser = {
    json: function(options) {
      return WebApp.express.json(options);
    },
    urlencoded: function(options) {
      return WebApp.express.urlencoded(options);
    },
    text: function(options) {
      return WebApp.express.text(options);
    }
  };
} else {
  // Meteor < 3.0 - use external body-parser package
  Router.bodyParser = Npm.require('body-parser');
}
