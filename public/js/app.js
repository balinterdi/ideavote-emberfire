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
// App.User = Ember.Object.extend({
//   initialVotes: 10,
//
//   name: DS.attr('string'),
//   displayName: DS.attr('string'),
//   avatarUrl: DS.attr('string'),
//   displayName: DS.attr('string'),
//   votesEarned: DS.attr('number'),
//   votesCast: DS.attr('number', { defaultValue: 0 }),
//
//   _votesEarned: function() {
//     //NOTE: Unfortunately { defaultValue: 0 } does not work
//     //since the model is already fetched from the database before creating it
//     return this.get('votesEarned') || 0;
//   }.property('votesEarned'),
//
//   votesLeft: function() {
//     return this.get('initialVotes') - this.get('votesCast') + this.get('_votesEarned');
//   }.property('initialVotes', 'votesCast', '_votesEarned')
// });

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

  vote: function() {
    var user = this.get('auth.currentUser');
    var vote = App.Vote.createRecord({ voter: user, idea: this.get('model'), createdAt: new Date() });
  },

  usersVote: function() {
    var user = this.get('auth.currentUser');
    return this.get('model').voteOf(user);
  }.property('auth.currentUser', 'votes.@each'),
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
        timestamp: new Date()
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
        var user = EmberFire.Object.create({ ref: userRef });
        user.setProperties({
          id: githubUser.username,
          name: githubUser.username,
          displayName: githubUser.displayName,
          avatarUrl: githubUser.avatar_url,
          votesLeft: 10
        });
        this.set('currentUser', user);
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

Ember.Handlebars.registerBoundHelper('votersSentence', function(votes, options) {
  var currentUser = options.data.keywords.controller.get('auth.currentUser')
  var sentence = ["Voted by"];
  var voterNames = votes.map(function(vote) {
    var voter = vote.get('voter');
    if (voter === currentUser) {
      return 'you';
    } else {
      return voter.get('name');
    }
  });

  var votesCount = votes.get('length');
  if (!votesCount) {
    sentence.push("nobody yet");
  } else {
    if (votesCount == 1) {
      sentence.push("<em>" + voterNames[0] + "</em>");
    } else {
      // Sort
      var sortedNames = [];
      var youIndex = voterNames.indexOf("you");
      if  (youIndex != -1) {
        sortedNames = ["you"].concat(voterNames.slice(0, youIndex)).concat(voterNames.slice(youIndex + 1));
      } else {
        sortedNames = voterNames;
      }
      sortedNames = sortedNames.map(function(name) {
        return "<em>" + name + "</em>";
      });
      butlast = sortedNames.slice(0, votesCount - 1);
      sentence.push(butlast.join(', '));
      sentence.push('and ' + sortedNames[voterNames.length - 1]);
    }
  }
  return new Handlebars.SafeString(sentence.join(' '));
}, '@each');

