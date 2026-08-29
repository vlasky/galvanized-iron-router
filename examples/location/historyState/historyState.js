if (Meteor.isClient) {
  Template.hello.helpers({
    historyState: function() {
      return Iron.Location.get().options && 
        Iron.Location.get().options.historyState;
    }
  });
  
  Template.hello.events({
    'submit #push': function(e, t) {
      e.preventDefault();
      var state = e.currentTarget.querySelector('input').value;
      Iron.Location.go('/' + Random.id(), {historyState: state});
    },
    'submit #replace': function(e, t) {
      e.preventDefault();
      var state = e.currentTarget.querySelector('input').value;
      Iron.Location.replaceState(state);
    }
  });
  
  Iron.Location.onGo(function() {
    console.log('go:', this);
  });
  
  Iron.Location.onPopState(function() {
    console.log('popstate:', this);
  });
}
