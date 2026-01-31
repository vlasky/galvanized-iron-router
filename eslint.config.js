import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.meteor,
        // Meteor globals
        Meteor: "readonly",
        Tracker: "readonly",
        Blaze: "readonly",
        Template: "readonly",
        Session: "readonly",
        ReactiveVar: "readonly",
        ReactiveDict: "readonly",
        EJSON: "readonly",
        Random: "readonly",
        WebApp: "readonly",
        Npm: "readonly",
        Package: "readonly",
        Assets: "readonly",
        // Iron Router globals
        Iron: "writable",
        Router: "writable",
        RouteController: "writable",
        // Test globals
        Tinytest: "readonly",
        // Underscore
        _: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["error", {
        "vars": "all",
        "args": "none",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-undef": "error",
      "no-redeclare": "warn",
      "no-prototype-builtins": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },
  },
  {
    // Test files have more relaxed rules
    files: ["test/**/*.js"],
    languageOptions: {
      globals: {
        // Test-specific globals created by Iron.Class or similar
        Handler: "writable",
        Parent: "writable",
        Child: "writable",
        ChildB: "writable",
        WaitList: "writable",
        ReadyHandle: "writable",
        list: "writable",
        urlToHashStyle: "readonly",
        urlFromHashStyle: "readonly",
        newController: "writable",
        Fiber: "readonly",
      },
    },
    rules: {
      // Allow unused variables in tests (common pattern)
      "no-unused-vars": ["error", {
        "vars": "all",
        "args": "none",
        "varsIgnorePattern": "^_|^reactiveTemplate$|^reactiveData$|^calls$|^params$|^hooks$|^c$|^c1$|^c2$|^Fiber$|^WaitList$",
        "caughtErrorsIgnorePattern": "^_|^e$"
      }],
      // Allow redeclarations in tests
      "no-redeclare": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".meteor/**",
      "examples/**",
      "lib/url/old_compiler.js",
    ],
  },
];
