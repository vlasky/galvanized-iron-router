// Local test driver, never published. See driver.js for why it exists and
// "Running the tests" in the README for how to run the suite with it.
Package.describe({
  name: 'tinytest-plain-driver',
  version: '0.0.1',
  summary: 'Minimal Tinytest browser driver with no jQuery dependency'
});

Package.onUse(function (api) {
  api.use(['ecmascript', 'tinytest']);
  api.mainModule('driver.js', 'client');
});
