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
