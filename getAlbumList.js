'use strict';

var xml2js = require('xml2js');
var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var request = require('co-request');
var readOriginal = require('read');
var read = function* (){
  var results = yield thunkify(readOriginal).apply(this, arguments);
  return results[0];
};
var argParser = require('yargs');

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
	desc: 'Album name where files upload.',
});
argParser.help('h').alias('h', 'help');

var ARGV = argParser.argv;
var username = ARGV.u;
var password = ARGV.p;
var albumName = ARGV.a;
console.log(albumName);
ARGV = ARGV._;

var cookie_jar = request.jar();
request = request.defaults({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.52 Safari/537.36',
  },
  jar: cookie_jar
});

co(function* () {
  username = username || (yield read({ prompt: 'Username: ', output: process.stderr }));
  password = password || (yield read({ prompt: 'Password: ', output: process.stderr, silent: true }));

  var loginUrl = 'https://accounts.google.com/ServiceLoginAuth?service=lh2';
  yield request.get(loginUrl);

  var _GALX;
  cookie_jar.getCookies(loginUrl).forEach(function(cookie){
    if (cookie.key === 'GALX') _GALX = cookie.value;
  });

  var loginData = {
    Email: username, Passwd: password,
    GALX: _GALX, _utf8: '\u9731',
    pstMsg: 1, bgresponse: 'js_disabled',
    checkedDomains: 'youtube',
    checkConnection: 'youtube:56:1',
    PersistentCookie: 'yes',
  };

  var loginResult = yield request.post(loginUrl, { form: loginData });

  if (loginResult.statusCode !== 302) {
    console.error('Failed to login...');
    throw new Error('LoginError');
  }
  console.warn('Success to login!');

  var gplus = yield request.head('https://plus.google.com/u/0/me');
  var userId = gplus.request.uri.href.split('/').reverse()[0];
  console.warn("UserID is %s.", userId);

  var albumListRssUrl =
    'https://picasaweb.google.com/data/feed/api/user/' + userId + '?alt=rss&kind=album&hl=ja';
  var albumListRss = yield request.get(albumListRssUrl);

  var parser = new xml2js.Parser({ explicitArray : false });
  parser.parseString = thunkify(parser.parseString);
  var albumListJSON = yield parser.parseString(albumListRss.body);
  var albumList = albumListJSON.rss.channel.item;

  var albumInfo;
  albumList.forEach(function(info) {
    if (albumInfo !== undefined) return;
    if (info.title === albumName) {
      albumInfo = info;
    }
  });

  console.log(JSON.stringify(albumInfo));
}).catch(function (err) {
  console.error(err.stack);
});
