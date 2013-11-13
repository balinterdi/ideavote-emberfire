// TODOS:
// - Remove ideas/new route
// - Inject auth to all routes and controllers to do away with all the needs calls
// - Don't let user vote on the same idea multiple times
App = Ember.Application.create();

var dbRoot = "https://emberfire-ideavote.firebaseio.com"
var dbRef = new Firebase(dbRoot);

var ideasPath = dbRoot + "/ideas";
var usersPath = dbRoot + "/users";

// App.Idea = Ember.Object.extend({
//   title: DS.attr('string'),
//   timestamp: DS.attr('date'),
//
//   voteCount: Ember.computed.alias('votes.length'),
//   voteOf: function(user) {
//     return this.get('votes').find(function(vote) {
//       return vote.get('voter') === user;
//     });
//   },
//
//   isVotedBy: function(user) {
//     return this.get('votes').mapProperty('voter').contains(user);
//   }
// });
//
App.User = EmberFire.Object.extend({
  noVotesLeft: Ember.computed.lte('votesLeft', 0)
});

App.Router.map(function() {
  this.resource('ideas', function() {
    this.route('new');
  });
});

App.IndexRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('ideas.index');
  }
});

App.IdeasRoute = Ember.Route.extend({
  model: function() {
    return EmberFire.Array.create({
      ref: new Firebase(ideasPath)
    });
  }
});

App.IdeasIndexRoute = Ember.Route.extend({
  //TODO: Retrieve /ideas here, see IdeasNewRoute
  redirect: function() {
    this.transitionTo('ideas.new');
  }
});

App.IdeasNewRoute = Ember.Route.extend({
  // No separate route needed for the new action, just {{ render }} it
  model: function() {
    return EmberFire.Array.create({
      ref: new Firebase(ideasPath)
    });
  }
});

App.ApplicationController = Ember.Controller.extend({
  auth: null,
  needs: ['auth'],
  authBinding: 'controllers.auth',

  login: function() {
    this.get('auth').login();
  },

  logout: function() {
    this.get('auth').logout();
  }
});

App.IdeasController = Ember.ArrayController.extend({
  sortProperties: ['voteCount', 'title'],
  sortAscending: false
});

App.IdeaController = Ember.ObjectController.extend({
  auth: null,
  needs: 'auth',
  authBinding: 'controllers.auth',

  displayable: function() {
    return !(Ember.isEmpty(this.get('title')) || this.get('isNew'));
  }.property('isNew', 'title'),

  isDisabled: function() {
    return Ember.isEmpty(this.get('title'));
  }.property('title'),

  actions: {
    vote: function() {
      var user = this.get('auth.currentUser');
      this.incrementProperty('voteCount');
      user.decrementProperty('votesLeft');
    },
  }
});

App.IdeasNewController = Ember.ObjectController.extend({
  auth: null,
  title: '',
  needs: 'auth',
  authBinding: 'controllers.auth',

  isDisabled: function() {
    return Ember.isEmpty(this.get('title'));
  }.property('title'),

  actions: {
    sendIdea: function() {
      var newIdeaRef = new Firebase(ideasPath).push();
      var newIdea = EmberFire.Object.create({ ref: newIdeaRef });
      newIdea.setProperties({
        title: this.get('title'),
        submittedBy: this.get('auth.currentUser.id'),
        timestamp: new Date(),
        voteCount: 0
      });
      this.set('title', '');
    }
  },

  login: function() {
    this.get('auth').login();
  }

});

App.AuthController = Ember.Controller.extend({
  authed: false,
  currentUser: null,

  init: function() {
    this.authClient = new FirebaseSimpleLogin(dbRef, function(error, githubUser) {
      if (error) {
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

