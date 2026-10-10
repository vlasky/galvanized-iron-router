// set of test URLs
var URLS = [
  {
    base: 'http://host:port/some/pathname/?query=string#bar',
    hash: 'http://host:port#!some/pathname/?query=string&__hash__=bar'
  },
  {
    // using a param called 'hash'
    base: 'http://host:port/some/pathname/?hash=string',
    hash: 'http://host:port#!some/pathname/?hash=string'
  } 
]

Tinytest.add('Location - urlToHashStyle', function (test) {
  URLS.forEach(function(urls) {
    test.equal(urlToHashStyle(urls.base), urls.hash);
  });
});


Tinytest.add('Location - urlFromHashStyle', function (test) {
  URLS.forEach(function(urls) {
    test.equal(urlFromHashStyle(urls.hash), urls.base);
  });
});

Tinytest.add('Location - delegates nested link clicks with native events', function (test) {
  var link = document.createElement('a');
  var child = document.createElement('span');
  var event = new MouseEvent('click', {bubbles: true, cancelable: true});

  link.href = location.href;
  link.appendChild(child);
  document.body.appendChild(link);

  try {
    child.dispatchEvent(event);
    test.isTrue(event.defaultPrevented,
      'a click on nested link content is handled through the matching anchor');
    Tracker.flush();
  } finally {
    link.remove();
  }
});

Tinytest.add('Location - stop and restart manage one document listener', function (test) {
  var addEventListener = document.addEventListener;
  var removeEventListener = document.removeEventListener;
  var clickAdds = 0;
  var clickRemoves = 0;
  var locationClickListener;

  document.addEventListener = function (type, listener, options) {
    if (type === 'click' && listener === locationClickListener)
      clickAdds++;
    return addEventListener.call(this, type, listener, options);
  };

  document.removeEventListener = function (type, listener, options) {
    if (type === 'click') {
      clickRemoves++;
      locationClickListener = listener;
    }
    return removeEventListener.call(this, type, listener, options);
  };

  try {
    Iron.Location.stop();
    test.equal(clickRemoves, 1, 'stop removes the delegated click listener');
    Iron.Location.start();
    test.equal(clickAdds, 1, 'restart adds the delegated click listener once');
  } catch (err) {
    test.fail(err.message);
  } finally {
    document.addEventListener = addEventListener;
    document.removeEventListener = removeEventListener;
  }
});

Tinytest.add('Location - configure and start reject an invalid linkSelector', function (test) {
  var options = Iron.Location.options;
  var original = options.linkSelector;

  test.throws(function () {
    Iron.Location.configure({linkSelector: 'a:visible'});
  }, /Invalid linkSelector/);
  test.equal(options.linkSelector, original,
    'a rejected selector leaves the options unchanged');

  options.linkSelector = 'a[';
  try {
    Iron.Location.stop();
    test.throws(function () {
      Iron.Location.start();
    }, /Invalid linkSelector/);
  } finally {
    options.linkSelector = original;
    Iron.Location.start();
  }
});

Tinytest.add('Location - going to the current url with a fragment reruns observers (upstream #557)', function (test) {
  // A click on a link to the current url with a fragment is intercepted, so
  // the browser never re-scrolls; the router must be rerun to do it instead.
  var pushes = 0;
  var runs = 0;
  var comp;
  var ownPush = Object.getOwnPropertyDescriptor(history, 'pushState');
  var ownReplace = Object.getOwnPropertyDescriptor(history, 'replaceState');

  history.pushState = function () { pushes++; };
  history.replaceState = function () {};

  try {
    comp = Tracker.autorun(function () {
      Iron.Location.get();
      runs++;
    });

    Iron.Location.go('/location-fragment-test#section');
    Tracker.flush();
    test.equal(runs, 2, 'a new url reruns observers');
    test.equal(pushes, 1, 'a new url is pushed onto the history');

    Iron.Location.go('/location-fragment-test#section');
    Tracker.flush();
    test.equal(runs, 3, 'the same url with a fragment reruns observers again');
    test.equal(pushes, 1, 'but is not pushed onto the history again');

    Iron.Location.go('/location-fragment-test');
    Tracker.flush();
    Iron.Location.go('/location-fragment-test');
    Tracker.flush();
    test.equal(runs, 4, 'the same url without a fragment is still a no-op');
    test.equal(pushes, 2);
  } finally {
    if (comp)
      comp.stop();
    // put the location state back in step with the real url and history
    // state (the history stubs are still in place, so nothing is written)
    Iron.Location.go(location.href, {replaceState: true, historyState: history.state});
    Tracker.flush();
    if (ownPush) Object.defineProperty(history, 'pushState', ownPush); else delete history.pushState;
    if (ownReplace) Object.defineProperty(history, 'replaceState', ownReplace); else delete history.replaceState;
  }
});

Tinytest.add('Location - a trailing #! on a real pathname is not a hash-style url (upstream #1584)', function (test) {
  var href = location.href;
  var historyState = history.state;
  var state;

  try {
    Iron.Location.stop();

    // some crawlers append a bare "#!"; this used to be rewritten to "/"
    history.replaceState(null, null, '/posts/hello#!');
    Iron.Location.start();
    state = Iron.Location.get();
    test.equal(state.pathname, '/posts/hello', 'the pathname is kept');
    test.equal(state.hash, '#!', 'the fragment is kept');
    Iron.Location.stop();

    // the legacy hash-style url (root pathname) is still rewritten
    history.replaceState(null, null, '/#!posts/hello?x=1');
    Iron.Location.start();
    state = Iron.Location.get();
    test.equal(state.pathname, '/posts/hello', 'a hash-style url is converted to a pathname');
    test.equal(state.search, '?x=1', 'its query string is kept');
    test.equal(state.hash, '', 'and the hashbang is gone');
    Iron.Location.stop();

    // a hash path with content is still converted whatever the pathname
    history.replaceState(null, null, '/old/#!items/5');
    Iron.Location.start();
    state = Iron.Location.get();
    test.equal(state.pathname, '/items/5', 'a non-empty hash path wins over the pathname, as before');
    Iron.Location.stop();

    // a hashbang followed only by a query is not bare either
    history.replaceState(null, null, '/old/#!?x=1');
    Iron.Location.start();
    state = Iron.Location.get();
    test.equal(state.pathname, '/', 'a hashbang carrying a query is still converted');
    test.equal(state.search, '?x=1', 'and keeps the query');
  } finally {
    // Location.start installs its own {initial: true} history state, which is
    // what the page had at load, so Location and history stay consistent
    Iron.Location.stop();
    history.replaceState(historyState, null, href);
    Iron.Location.start();
  }
});

Tinytest.add('Location - links that opt out of routing are left to the browser', function (test) {
  // download links, rel="external" and Alt-clicks (browser download) were
  // intercepted like any other same-origin link
  var cases = [
    {name: 'download attribute', setup: function (a) { a.setAttribute('download', ''); }},
    {name: 'rel external (mixed case, several tokens)', setup: function (a) { a.setAttribute('rel', 'noopener External'); }},
    {name: 'alt-click', init: {altKey: true}},
    {name: 'middle button', init: {button: 1}},
    {name: 'target attribute', setup: function (a) { a.setAttribute('target', '_blank'); }}
  ];

  // A synthetic click on an anchor the router leaves alone really activates
  // the link (the test page would reload or open a window). Observe what the
  // router did from a later document listener, then cancel the activation.
  var routed;
  var observe = function (e) {
    routed = e.defaultPrevented;
    e.preventDefault();
  };
  document.addEventListener('click', observe);

  try {
    cases.forEach(function (c) {
      var link = document.createElement('a');
      link.href = location.href;
      if (c.setup) c.setup(link);
      document.body.appendChild(link);
      try {
        routed = undefined;
        link.dispatchEvent(new MouseEvent('click', Object.assign({bubbles: true, cancelable: true}, c.init || {})));
        test.isFalse(routed, c.name + ' is not routed');
      } finally {
        link.remove();
      }
    });

    // and rel values that merely contain the letters are not an opt-out
    var link = document.createElement('a');
    link.href = location.href;
    link.setAttribute('rel', 'externalish noopener');
    document.body.appendChild(link);
    try {
      routed = undefined;
      link.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
      test.isTrue(routed, 'a rel token that is not exactly "external" is still routed');
      Tracker.flush();
    } finally {
      link.remove();
    }
  } finally {
    document.removeEventListener('click', observe);
  }
});
