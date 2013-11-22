// TODOS:
App = Ember.Application.create({
  ready: function() {
    this.register('main:auth', App.AuthController);
    this.inject('route', 'auth', 'main:auth');
    this.inject('controller', 'auth', 'main:auth');
  }
});

var dbRoot = "https://emberfire-ideavote.firebaseio.com"
var dbRef = new Firebase(dbRoot);

var ideasPath = dbRoot + "/ideas";
var usersPath = dbRoot + "/users";

App.User = EmberFire.Object.extend({
  noVotesLeft: Ember.computed.lte('votesLeft', 0),
  hasVotedOn: function(ideaId) {
    var votedOn = this.get('votedOn');
    return votedOn && votedOn.get(ideaId);
  }
});

App.Router.map(function() {
  this.resource('ideas');
});

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    login: function() {
      this.get('auth').login();
    },

    logout: function() {
      this.get('auth').logout();
    }
  }
});

App.IndexRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('ideas');
  }
});

App.IdeasRoute = Ember.Route.extend({
  model: function() {
    return EmberFire.Array.create({
      ref: new Firebase(ideasPath)
    });
  }
});

App.IdeasController = Ember.ArrayController.extend({
  sortProperties: ['voteCount', 'title'],
  sortAscending: false
});

App.IdeaController = Ember.ObjectController.extend({
  displayable: Ember.computed.not('isNew'),
  outOfVotes:  Ember.computed.alias('auth.currentUser.noVotesLeft'),
  voteable: function() {
    var user = this.get('auth.currentUser');
    if (!user) {
      console.log("Current user not yet known");
    }
    //TODO: Sometimes this.get('model') is an Emberfire.Object and other timer it is just a POJO
    if (this.get('model.id')) {
      console.log("I'm an EmberFire.Object Idea");
    } else {
      console.log("I'm a POJO Idea");
    }
    var ideaId = this.get('model.id');
    return !(user && user.hasVotedOn(ideaId));
  }.property('auth.currentUser', 'model'),

  actions: {
    vote: function() {
      var user = this.get('auth.currentUser'),
          votedOnPath = usersPath + '/' + user.get('id') + '/votedOn',
          votedOn = EmberFire.Object.create({ ref: new Firebase(votedOnPath) }),
          voteCountRef = this.get('model').ref.child('voteCount');

      votedOn.set(this.get('id'), true);
      voteCountRef.transaction(function(count) {
        return count + 1;
      });
      user.decrementProperty('votesLeft');
    },
  }
});

App.IdeasNewController = Ember.ObjectController.extend({
  title: '',
  isDisabled: Ember.computed.empty('title'),

  actions: {
    sendIdea: function() {
      var newIdeaRef = new Firebase(ideasPath).push();
      var newIdea = EmberFire.Object.create({ ref: newIdeaRef });
      newIdea.setProperties({
        id: newIdeaRef.name(),
        title: this.get('title'),
        submittedBy: this.get('auth.currentUser.id'),
        timestamp: new Date(),
        voteCount: 0
      });
      this.set('title', '');
    }
  }

});

App.AuthController = Ember.Controller.extend({
  authed: false,
  currentUser: null,

  init: function() {
    this.authClient = new FirebaseSimpleLogin(dbRef, function(error, githubUser) {
      if (error) {
        alert('Authentication failed: ' + error);
      } else if (githubUser) {
        this.set('authed', true);
        var userRef = new Firebase(usersPath + '/' + githubUser.username);
        var controller = this;
        var properties = {
          id: githubUser.username,
          name: githubUser.username,
          displayName: githubUser.displayName,
          avatarUrl: githubUser.avatar_url,
        };
        userRef.once('value', function(snapshot) {
          if (!snapshot.val()) {
            properties.votesLeft = 10;
          } else {
            properties.votesLeft = snapshot.val().votesLeft;
          }
          var user = App.User.create({ ref: userRef });
          user.setProperties(properties);
          controller.set('currentUser', user);
        });
      } else {
        this.set('authed', false);
      }
    }.bind(this));
  },

  login: function() {
    this.authClient.login('github');
  },

  logout: function() {
    this.authClient.logout();
  }

});

