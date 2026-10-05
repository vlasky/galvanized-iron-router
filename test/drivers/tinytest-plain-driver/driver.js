import { Tinytest } from 'meteor/tinytest';

// A minimal Tinytest browser driver with no jquery dependency.
//
// The stock drivers (test-in-browser, test-in-console) both depend on jquery,
// so under them Blaze 3.1+ always selects its jQuery DOM backend and its
// native DOM backend never runs. This driver runs the same tests with nothing
// pulling jQuery into the client bundle.
//
// Results are exposed the way test-in-console exposes them, on
// window.TEST_STATUS, plus a plain-text summary in the page.
const status = window.TEST_STATUS = {
  DONE: false,
  PASSED: 0,
  EXPECTED: 0,
  FAILURES: 0,
  TOTAL: 0,
  WHERE_FAILED: [],
  // true means the run is NOT exercising the native backend
  JQUERY: typeof window.jQuery !== 'undefined' || !!Package.jquery
};

const results = {};

const nameOf = (report) =>
  (report.server ? 'S: ' : 'C: ') + report.groupPath.join(' - ') + ' - ' + report.test;

const recordFailure = (name, entry, prefix) => {
  status.FAILURES++;
  status.WHERE_FAILED.push({name, info: (prefix + entry.info.join(' | ')).slice(0, 600)});
};

const render = () => {
  let el = document.getElementById('tinytest-plain');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'tinytest-plain';
    document.body.appendChild(el);
  }
  el.textContent = (status.DONE ? 'DONE' : 'RUNNING') +
    '\nPassed ' + status.PASSED + ' of ' + status.TOTAL +
    ' (failed ' + status.FAILURES + ', expected failures ' + status.EXPECTED + ')' +
    '\njQuery present: ' + status.JQUERY +
    status.WHERE_FAILED.map((f) => '\nFAIL ' + f.name + '\n  ' + f.info).join('');
};

// Meteor's test runner looks this export up on the driver package and calls
// it once the client has loaded.
export const runTests = () => {
  Tinytest._runTestsEverywhere((report) => {
    const name = nameOf(report);
    const entry = results[name] ||
      (results[name] = {status: 'PENDING', finished: false, info: []});

    report.events.forEach((event) => {
      switch (event.type) {
        case 'ok':
          break;
        case 'expected_fail':
          if (entry.status !== 'FAIL') entry.status = 'EXPECTED';
          break;
        case 'finish':
          if (entry.finished) break;
          entry.finished = true;
          if (entry.status === 'PENDING') {
            entry.status = 'OK';
            status.PASSED++;
          } else if (entry.status === 'EXPECTED') {
            status.EXPECTED++;
          } else {
            recordFailure(name, entry, '');
          }
          break;
        default: // 'fail' and 'exception'
          entry.status = 'FAIL';
          entry.info.push(event.type + ': ' + JSON.stringify(event.details || {}).slice(0, 300));
      }
    });

    status.TOTAL = Object.keys(results).length;
    render();
  }, () => {
    // A test that started but never finished counts as a failure.
    Object.keys(results).forEach((name) => {
      if (!results[name].finished)
        recordFailure(name, results[name], 'no finish event; ');
    });
    status.DONE = true;
    render();
  }, ['tinytest']); // the root group every Tinytest lives under; the server method requires it
};
