'use strict';

var fs = require('fs');
var path = require('path');
var co = require('co');
var thunkify = require('thunkify');
var request = require('co-request');
var pipeRequest = function (readable, requestThunk){
  return function (cb){
    readable.pipe(requestThunk(cb));
  };
};
var readOriginal = require('read');
var read = function* (){
  var results = yield thunkify(readOriginal).apply(this, arguments);
  return results[0];
};
var argParser = require('yargs');

argParser.demand(1);
argParser.usage('Usage: $0 [file]');
argParser.options('u', {
	alias: 'username',
	desc: 'Google account username.',
});
argParser.options('p', {
	alias: 'password',
	desc: 'Google account password.',
});

var ARGV = argParser.argv;
var username = ARGV.u;
var password = ARGV.p;
ARGV = ARGV._;

ARGV.forEach(function(filepath) {
  if (!fs.existsSync(filepath)) {
    argParser.showHelp();
    process.exit();
  }
});

var cookie_jar = request.jar();
request = request.defaults({
  headers: {
    'User-Agent':
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.52 Safari/537.36',
  },
  jar: cookie_jar
});

co(function* () {
  username = username || (yield read({ prompt: 'Username: ' }));
  password = password || (yield read({ prompt: 'Password: ', silent: true }));

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

  var sendInfo = JSON.parse(fs.readFileSync('sendRequest.json', 'utf8'));

  var upload = co.wrap(function*(filepath) {
    sendInfo.createSessionRequest.fields.forEach(function(field){
      if ('external' in field) {
        field.external.filename = path.basename(filepath);
        field.external.size = fs.statSync(filepath).size;
      } else if ('inlined' in field) {
        var name = field.inlined.name;
        if (name !== 'effective_id' && name !== 'owner_name') return;
        field.inlined.content = userId;
      }
    });

    var serverStatusRes = yield request({
      method: 'POST',
      url: 'https://photos.google.com/_/upload/photos/resumable?authuser=0',
      body: JSON.stringify(sendInfo),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
    });

    if (serverStatusRes.statusCode !== 200) {
      console.error('ServerError.\n%s', JSON.stringify(serverStatusRes));
      throw new Error('ServerError');
    }

    var serverStatus = JSON.parse(serverStatusRes.body);

    if (!('sessionStatus' in serverStatus)) {
      console.error('ServerError.\n%s', serverStatusRes.body);
      throw new Error('ServerError');
    }

    var sendUrl = serverStatus.sessionStatus.externalFieldTransfers[0].putInfo.url;

    var resultRes = yield pipeRequest(
      fs.createReadStream(filepath),
      request({
        method: 'POST',
        url: sendUrl,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-HTTP-Method-Override': 'PUT'
        }
      })
    );

    console.warn('');
    console.info(resultRes.body);
  });

  ARGV.forEach(function(filepath) {
    upload(filepath).catch(function (err){ throw err; });
  });
}).catch(function (err) {
  console.error(err.stack);
});
