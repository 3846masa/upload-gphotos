'use strict';

var colors = require('colors');
var xml2js = require('xml2js');
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
var heredoc = function(fn){
  var results = fn.toString().match(/\/\*([\s\S]*)\*\//);
  return (results !== null) ? results[1] : '';
};

var sendInfo = JSON.parse(heredoc(function(){/*
  {"protocolVersion":"0.8","createSessionRequest":{"fields":[
  {"external":{"name":"file","filename":"","put":{},"size":0}},
  {"inlined":{"name":"auto_create_album","content":"camera_sync.active","contentType":"text/plain"}},
  {"inlined":{"name":"auto_downsize","content":"true","contentType":"text/plain"}},
  {"inlined":{"name":"storage_policy","content":"use_manual_setting","contentType":"text/plain"}},
  {"inlined":{"name":"disable_asbe_notification","content":"true","contentType":"text/plain"}},
  {"inlined":{"name":"client","content":"photosweb","contentType":"text/plain"}},
  {"inlined":{"name":"effective_id","content":"","contentType":"text/plain"}},
  {"inlined":{"name":"owner_name","content":"","contentType":"text/plain"}}]}}
*/}));

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
    self.searchAlbum = thunkify(self.searchAlbum.bind(self));
    self.createAlbum = thunkify(self.createAlbum.bind(self));
    self.getAlbum = thunkify(self.getAlbum.bind(self));
    self.moveItem = thunkify(self.moveItem.bind(self));
    self.upload = thunkify(self.upload.bind(self));
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

GPhotos.prototype.searchAlbum = function(albumName, cb) {
  var self = this;
  albumName = albumName.toString();

  co(function* (){
    var albumListRssUrl =
      'https://picasaweb.google.com/data/feed/api/user/' + self.userId + '?alt=rss&kind=album&hl=ja';

    var parser = new xml2js.Parser({ explicitArray : false });
    parser.parseString = thunkify(parser.parseString);

    var albumInfo = null;
    var cursor = 1;
    while (true) {
      var albumListRss =
        yield self.request.get(albumListRssUrl + '&start-index=' + cursor);

      var albumListJSON = yield parser.parseString(albumListRss.body);
      var albumList = albumListJSON.rss.channel.item;
      if (albumList === undefined || albumList.length === 0) break;
      cursor += albumList.length;

      albumList.forEach(function(info) {
        if (albumInfo !== null) return;
        var isFound = info.title === albumName ||
                      info['gphoto:name'] === albumName ||
                      ( albumName.match(/^\d+$/) &&
                        info['gphoto:id'] === albumName );
        if (isFound) {
          albumInfo = info;
        }
      });

      if (albumInfo !== null) break;
    }

    return albumInfo;
  }).then(function(albumInfo) {
    var args = [null];
    for (var _i = 0; _i < arguments.length; _i++) {
      args.push(arguments[_i]);
    }
    cb.apply(self, args);
  }).catch(function (){
    cb.apply(self, arguments);
  });
};

GPhotos.prototype.createAlbum = function(albumName, cb) {
  var self = this;
  albumName = albumName.toString();

  co(function*() {
    var picasaHome = yield self.request.get('https://picasaweb.google.com/home');
    if (! picasaHome.body.match(/var _createAlbumPath = '(.*?)'/)) {
      throw new Error('_createAlbumPath is not found.');
    }
    var createUrl = RegExp.$1;

    var createQuery = yield self.request({
      method: 'POST',
      url: 'https://picasaweb.google.com/' + createUrl,
      form: {
        uname: self.userId,
        title: albumName,
        access: 'only_you',
        description: '',
        location: '',
        date: (function(d){
            return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
          })(new Date())
      },
    });

    if (createQuery.statusCode !== 302) {
      throw new Error('CreateAlbumError');
    }

    var albumUniqueName = createQuery.headers.location.split('/').reverse()[0];
    var albumInfoRSS = yield self.request.get(
      'https://picasaweb.google.com/data/feed/api/user/' + self.userId +
      '/album/' + albumUniqueName + '?alt=rss');

    var parser = new xml2js.Parser({ explicitArray : false });
    parser.parseString = thunkify(parser.parseString);
    var albumInfoJSON = yield parser.parseString(albumInfoRSS.body);
    var albumId = albumInfoJSON.rss.channel['gphoto:id'];

    console.warn("AlbumID is %s.", albumId);
    if (self.options.thunkify === false) {
      return yield thunkify(self.searchAlbum)(albumId);
    } else {
      return yield self.searchAlbum(albumId);
    }
  }).then(function(albumInfo) {
    var args = [null];
    for (var _i = 0; _i < arguments.length; _i++) {
      args.push(arguments[_i]);
    }
    cb.apply(self, args);
  }).catch(function (){
    cb.apply(self, arguments);
  });
};

GPhotos.prototype.getAlbum = function(albumName, cb) {
  var self = this;

  co(function*() {
    var albumInfo;
    if (self.options.thunkify === false) {
      albumInfo =
        (yield thunkify(self.searchAlbum)(albumName)) ||
        (yield thunkify(self.createAlbum)(albumName));
    } else {
      albumInfo =
        (yield self.searchAlbum(albumName)) || (yield self.createAlbum(albumName));
    }
    return albumInfo;
  }).then(function(albumInfo) {
    var args = [null];
    for (var _i = 0; _i < arguments.length; _i++) {
      args.push(arguments[_i]);
    }
    cb.apply(self, args);
  }).catch(function (){
    cb.apply(self, arguments);
  });
}

GPhotos.prototype.moveItem = function(itemId, itemAlbumId, newAlbumId, cb) {
  var self = this;

  co(function* (){
    var picasaHome = yield self.request.get('https://picasaweb.google.com/home');
    if (! picasaHome.body.match(/var _copyOrMovePath = '(.*?)'/)) {
      throw new Error('_copyOrMovePath is not found.');
    }
    var moveUrl = RegExp.$1;

    var moveQuery = yield self.request({
      method: 'POST',
      url: 'https://picasaweb.google.com/' + moveUrl,
      form: {
        uname: self.userId,
        redir: '',
        dest: '',
        photoop: 'move',
        selectedphotos: itemId,
        srcAid: itemAlbumId,
        albumop: 'existing',
        aid: newAlbumId
      },
    });

    if (moveQuery.statusCode !== 302) {
      throw new Error('MoveItemError');
    }
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

GPhotos.prototype.upload = function(/*filePath, [fileName,] cb*/) {
  var self = this;
  var filePath = arguments[0];
  var cb, fileName;
  if (arguments.length === 2) {
    fileName = path.basename(filePath);
    cb = arguments[1];
  } else {
    fileName = arguments[1];
    cb = arguments[2];
  }

  if (!fs.existsSync(filePath)) {
    cb(new Error(filePath + ' isn\'t exist.'));
    return;
  }

  co(function*() {
    sendInfo.createSessionRequest.fields.forEach(function(field){
      if ('external' in field) {
        field.external.filename = fileName;
        field.external.size = fs.statSync(filePath).size;
      } else if ('inlined' in field) {
        var name = field.inlined.name;
        if (name !== 'effective_id' && name !== 'owner_name') return;
        field.inlined.content = self.userId;
      }
    });

    var serverStatusRes = yield self.request({
      method: 'POST',
      url: 'https://photos.google.com/_/upload/photos/resumable?authuser=0',
      body: JSON.stringify(sendInfo),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
    });

    if (serverStatusRes.statusCode !== 200) {
      throw new Error('ServerError');
    }

    var serverStatus = JSON.parse(serverStatusRes.body);
    if (!('sessionStatus' in serverStatus)) {
      throw new Error('ServerError');
    }

    var sendUrl = serverStatus.sessionStatus.externalFieldTransfers[0].putInfo.url;

    var progressBar = new ProgressBar('Uploading [:bar] :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: Math.max(0, process.stdout.columns - 25),
      total: fs.statSync(filePath).size
    });

    var fileReadStream = fs.createReadStream(filePath);
    fileReadStream.on('open', function() {
      console.warn('');
    });
    fileReadStream.on('data', function(chunk) {
      progressBar.tick(chunk.length);
    });
    fileReadStream.on('end', function() {
      console.warn('');
    });

    var resultRes = yield pipeRequest(
      fileReadStream,
      self.request({
        method: 'POST',
        url: sendUrl,
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-HTTP-Method-Override': 'PUT'
        }
      })
    );

    var result = JSON.parse(resultRes.body);
    if (result.sessionStatus.state !== 'FINALIZED') {
      throw new Error('UploadError');
    }
    var uploadInfo = result.sessionStatus
                           .additionalInfo
                           ['uploader_service.GoogleRupioAdditionalInfo']
                           .completionInfo
                           .customerSpecificInfo;
    return uploadInfo;
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
