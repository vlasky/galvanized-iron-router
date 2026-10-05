Router.route('/router-helpers-target/:_id', {name: 'routerHelpersTarget'});

var withRenderedHelperTemplate = function (name, callback) {
  var el = document.createElement('div');
  document.body.appendChild(el);
  try {
    Blaze.render(Template[name], el);
    Tracker.flush();
    callback(el);
  } finally {
    document.body.removeChild(el);
  }
};

Tinytest.add('Router helpers - pathFor', function (test) {
  withRenderedHelperTemplate('RouterHelpersPathFor', function (el) {
    test.equal(el.textContent.trim(), '/router-helpers-target/7');
  });
});

Tinytest.add('Router helpers - linkTo renders an anchor', function (test) {
  withRenderedHelperTemplate('RouterHelpersLinkTo', function (el) {
    var a = el.querySelector('a');
    test.isTrue(!!a, 'an anchor is rendered');
    if (a) {
      test.equal(a.getAttribute('href'), '/router-helpers-target/5');
      test.equal(a.getAttribute('class'), 'my-cls');
      test.equal(a.textContent.trim(), 'Go');
    }
  });
});
