var WaitList = Iron.WaitList;

ReadyHandle = function () {
  this._ready = false;
  this._dep = new Tracker.Dependency;
};

ReadyHandle.prototype.set = function (value) {
  this._ready = value;
  this._dep.changed();
};

ReadyHandle.prototype.ready = function () {
  this._dep.depend();
  return this._ready;
};

Tinytest.add('WaitList - all', function (test) {
  list = new Iron.WaitList;

  var h1 = new ReadyHandle;
  var h2 = new ReadyHandle;

  var comp = Tracker.autorun(function (c) {
    list.wait(function () { return h1.ready(); });
    list.wait(function () { return h2.ready(); });
  });

  var result;

  Deps.autorun(function (c) {
    result = list.ready();
  });

  test.isFalse(result, 'list should not be ready');
  test.equal(list._notReadyCount, 2);

  h1.set(true);
  Tracker.flush();
  test.isFalse(result, 'list should still not be ready');
  test.equal(list._notReadyCount, 1);

  h2.set(true)
  Tracker.flush();
  test.isTrue(result, 'list should be ready');
  test.equal(list._notReadyCount, 0);

  test.equal(list._comps.length, 2);
  comp.invalidate();
  Tracker.flush();
  test.equal(list._comps.length, 2, 'comps list should not grow');
});

Tinytest.add('WaitList - delayed cleanup after stop() leaves new computations alone', function (test) {
  // The afterFlush cleanup for an invalidated wait removed the computation
  // by indexOf; after stop() had emptied the list that was splice(-1, 1),
  // which removed whatever had been added since.
  var list = new Iron.WaitList;
  var h1 = new ReadyHandle;

  var comp = Tracker.autorun(function () {
    list.wait(function () { return h1.ready(); });
  });
  test.equal(list._comps.length, 1);

  // the controller is stopped (empties the list) and re-run before the flush
  list.stop();
  test.equal(list._comps.length, 0);
  comp.invalidate();
  Tracker.flush();

  // the rerun added one computation; the old one's cleanup must not take it
  test.equal(list._comps.length, 1, 'the replacement wait is still tracked');
  var replacement = list._comps[0];
  test.isFalse(replacement.stopped, 'the replacement computation is alive');

  list.stop();
  test.isTrue(replacement.stopped, 'stop() reaches the replacement computation');
  comp.stop();
});
