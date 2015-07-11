'use strict';

var co = require('co');
var thunkify = require('thunkify');
var _readOriginal = require('read');
var read = function* (){
  var results = yield thunkify(_readOriginal).apply(this, arguments);
  return results[0];
};

var GPhotos = require('./gphotos.js');

co(function* () {
  var username = yield read({ prompt: 'Username: ', output: process.stderr });
  var password = yield read({ prompt: 'Password: ', output: process.stderr, silent: true });
  var gphotos = new GPhotos(username, password, { thunkify : true });
  yield gphotos.login();
  var album = yield gphotos.searchAlbum("6169149089637008385");
  console.log(album);
}).catch(function (err) {
  console.error(err.stack);
});
