'use strict';

var colors = require('colors');
var fs = require('fs');
var path = require('path');
var ProgressBar = require('progress');
var co = require('co');
var thunkify = require('thunkify');
var request = require('co-request');
var pipeRequest = function (readable, requestThunk){
  return function(cb) {
    readable.pipe(requestThunk(cb));
  };
};
var _readOriginal = require('read');
var read = function*() {
  var results = yield thunkify(_readOriginal).apply(this, arguments);
  return results[0];
};

var GPhotos = function(username, password, options) {
  var self = this;
  if (arguments.length >= 2) {
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw Error('Invalid arguments');
    }
    self.username = username;
    self.password = password;
    self.options = options || {};
  } else {
    throw Error('Invalid arguments');
  }

  self.init();
};

GPhotos.prototype.init = function() {
  var self = this;

  self.cookie_jar = request.jar();
  self.request = request.defaults({
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.52 Safari/537.36',
    },
    jar: self.cookie_jar
  });

  if (self.options.thunkify === true) {
    self.login = thunkify(self.login.bind(self));
  }
};

GPhotos.prototype.login = function(cb) {
  var self = this;

  co(function* (){
    var loginUrl = 'https://accounts.google.com/ServiceLoginAuth?service=lh2';
    yield self.request.get(loginUrl);

    var _GALX;
    self.cookie_jar.getCookies(loginUrl).forEach(function(cookie){
      if (cookie.key === 'GALX') _GALX = cookie.value;
    });

    var loginData = {
      Email: self.username, Passwd: self.password,
      GALX: _GALX, _utf8: '\u9731',
      pstMsg: 1, bgresponse: 'js_disabled',
      checkedDomains: 'youtube',
      checkConnection: 'youtube:56:1',
      PersistentCookie: 'yes',
    };

    var loginResult = yield self.request.post(loginUrl, { form: loginData });

    if (loginResult.statusCode !== 302) {
      console.error('Failed to login...'.red.inverse);
      throw new Error('LoginError');
    }
    console.warn('Success to login!'.green.inverse);

    var gplus = yield self.request.head('https://plus.google.com/u/0/me');
    self.userId = gplus.request.uri.href.split('/').reverse()[0];
    console.warn("UserID is %s.", self.userId);

    return true;
  }).then(function() {
    var args = [null];
    for (var _i = 0; _i < arguments.length; _i++) {
      args.push(arguments[_i]);
    }
    cb.apply(self, args);
  }).catch(function (){
    cb.apply(self, arguments);
  });
};

module.exports = GPhotos;
