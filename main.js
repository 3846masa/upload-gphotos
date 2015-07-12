'use strict';

var fs = require('fs');
var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var _readOriginal = require('read');
var read = function* (){
  var results = yield thunkify(_readOriginal).apply(this, arguments);
  return results[0];
};
var argParser = require('yargs');

argParser.demand(1);
argParser.usage('Usage: ' + path.basename(process.execPath) + ' [-u username] [-p password] file [...]');
argParser.options('u', {
	alias: 'username',
	desc: 'Google account username.',
});
argParser.options('p', {
	alias: 'password',
	desc: 'Google account password.',
});
argParser.options('a', {
	alias: 'album',
	desc: 'Album where uploaded files put.',
});
argParser.help('h').alias('h', 'help');

var ARGV = argParser.argv;
var username = ARGV.u;
var password = ARGV.p;
var album = ARGV.a || null;
ARGV = ARGV._;

ARGV.forEach(function(filepath) {
  if (!fs.existsSync(filepath)) {
    argParser.showHelp();
    process.exit();
  }
});

var GPhotos = require('./gphotos.js');

co(function* () {
  username = username || (yield read({ prompt: 'Username: ', output: process.stderr }));
  password = password || (yield read({ prompt: 'Password: ', output: process.stderr, silent: true }));
  var gphotos = new GPhotos(username, password, { thunkify : true });
  yield gphotos.login();

  var albumInfo = null;
  if (album !== null) {
    albumInfo = yield gphotos.getAlbum(album);
  }

  for (var _i = 0; _i < ARGV.length; _i++) {
    var filePath = ARGV[_i];
    var video = yield gphotos.upload(filePath);
    console.info(JSON.stringify(video));

    if (albumInfo !== null) {
      yield gphotos.moveItem(video.photoid, video.albumid, albumInfo['gphoto:id']);
    }
  }
}).catch(function (err) {
  console.error(err.stack);
});
