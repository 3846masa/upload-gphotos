import packageInfo from '../package.json';
import reqJSONTemplateGenerator from './request-json-template-generator';

import XMLParser from './xml-parser';
import winston, { Logger } from 'winston';
import request from 'request-promise';
import fs from 'fs-promise';
import ProgressBar from 'progress';
import url from 'url';
import path from 'path';
import moment from 'moment';
import colors from 'colors/safe';
import jsdom from './jsdom-async';

class GPhotos {
  constructor ({ username, password, options }) {
    this.username = username;
    this.password = password;
    this.options = options || {};

    this._cookieJar = request.jar();
    this._request = request.defaults({
      simple: false,
      resolveWithFullResponse: true,
      headers: {
        'User-Agent': `Mozilla/5.0 UploadGPhotos/${ packageInfo.version }`
      },
      jar: this._cookieJar
    });
    this._logger = this.options.logger || new Logger({
      transports: [
        new winston.transports.Console({
          colorize: true,
          stderrLevels: ['error', 'warn', 'info', 'verbose', 'debug', 'silly']
        })
      ]
    });
  }

  async login () {
    const loginUrl = 'https://accounts.google.com/ServiceLoginAuth?service=lh2';
    await this._request.get(loginUrl);

    const _GALX =
      this._cookieJar.getCookies(loginUrl)
        .filter((c) => c.key === 'GALX').pop().value;

    const loginData = {
      Email: this.username,
      Passwd: this.password,
      pstMsg: 1,
      GALX: _GALX,
      _utf8: '\u9731',
      bgresponse: 'js_disabled',
      checkedDomains: 'youtube',
      checkConnection: 'youtube:56:1',
      PersistentCookie: 'yes'
    };

    const loginRes = await this._request.post(loginUrl, { form: loginData });

    if (loginRes.statusCode !== 302) {
      this._logger.error('Failed to login...');
      return Promise.reject(new Error('Failed to login'));
    }
    this._logger.info('Success to login!');

    const gplusRes = await this._request.head('https://plus.google.com/u/0/me');
    this._userId = gplusRes.request.uri.href.split('/').reverse()[0];
    this._logger.info(`UserID is ${ this._userId }.`);

    await this.fetchAtParam();

    return true;
  }

  async fetchAtParam () {
    const gPhotosTopPageRes = await this._request.get('https://photos.google.com');
    if (gPhotosTopPageRes.statusCode !== 200) {
      this._logger.error('Can\'t access to Google Photos...');
      return Promise.reject(new Error('Failed to login'));
    }

    this._atParam = await this._generateAtParamFromHTMLAsync(gPhotosTopPageRes.body);
    this._logger.info(`atParam is ${ this._atParam }.`);
  }

  async _generateAtParamFromHTMLAsync (html) {
    const window = await jsdom.envAsync(html);
    if (window.photos_PhotosUi && window.photos_PhotosUi.He) {
      const atParam = window.photos_PhotosUi.He('SNlM0e').wa(null);
      window.close();
      return atParam;
    } else {
      return Promise.reject(new Error('Can\'t generate "at" param.'));
    }
  }

  async searchAlbum (albumName) {
    albumName = albumName.toString();

    const albumListRssBaseUrlObj = {
      protocol: 'https',
      host: 'picasaweb.google.com',
      path: path.join('data/feed/api/user/', this._userId)
    };

    const parser = new XMLParser({ explicitArray : false });

    let albumInfo = null;
    let cursor = 1;

    while (!albumInfo) {
      const albumListRssUrl =
        url.format(Object.assign({}, albumListRssBaseUrlObj, {
          query: {
            'start-index': cursor,
            alt: 'rss',
            kind: 'album',
            hl: 'ja'
          }
        }));
      const albumListRssRes = await this._request.get(albumListRssUrl);
      const albumListJSON = await parser.parseString(albumListRssRes.body);
      const albumList = albumListJSON.rss.channel.item;

      if (!albumList || albumList.length === 0) break;
      cursor += albumList.length;

      const checkFilter = (info) => {
        return info.title === albumName ||
          info['gphoto:name'] === albumName ||
          info['gphoto:id'] === albumName;
      };
      albumInfo = albumList.filter(checkFilter).shift();
    }

    if (!albumInfo) {
      this._logger.error(`Album "${ albumName }" is not found.`);
      return Promise.reject(new Error(`Album "${ albumName }" is not found.`));
    }
    return albumInfo;
  }

  async createAlbum (albumName) {
    albumName = albumName.toString();

    const picasaHome = await this._request.get('https://picasaweb.google.com/home');
    if (!picasaHome.body.match(/var _createAlbumPath = '.*?'/)) {
      this._logger.error('_createAlbumPath is not found.');
      return Promise.reject(new Error('_createAlbumPath is not found.'));
    }
    const createAlbumUrl = url.format({
      protocol: 'https',
      host: 'picasaweb.google.com',
      path: picasaHome.body.match(/var _createAlbumPath = '(.*?)'/)[1]
    });

    const createAlbumRes = await this._request({
      method: 'POST',
      url: createAlbumUrl,
      form: {
        uname: this._userId,
        title: albumName,
        access: 'only_you',
        description: '',
        location: '',
        date: moment().locale('en').format('l')
      }
    });

    if (createAlbumRes.statusCode !== 302) {
      this._logger.error(`Failed to create album "${ albumName }".`);
      return Promise.reject(new Error(`Failed to create album "${ albumName }".`));
    }

    const albumUniqueName = createAlbumRes.headers.location.split('/').reverse()[0];
    const albumInfoRSS = await this._request.get(url.format({
      protocol: 'https',
      host: 'picasaweb.google.com',
      path: path.join('data/feed/api/user/', this._userId, 'album/', albumUniqueName),
      query: { alt: 'rss' }
    }));

    const parser = new XMLParser({ explicitArray : false });
    const albumInfoJSON = await parser.parseString(albumInfoRSS.body);
    const albumId = albumInfoJSON.rss.channel['gphoto:id'];

    this._logger.info(`AlbumID is ${ albumId }.`);
    return this.searchAlbum(albumId);
  }

  async fetchAlbum (albumName) {
    return this.searchAlbum(albumName)
      .catch(() => this.createAlbum(albumName));
  }

  async moveItem (itemId, itemAlbumId, newAlbumId) {
    const picasaHome = await this._request.get('https://picasaweb.google.com/home');
    if (!picasaHome.body.match(/var _copyOrMovePath = '.*?'/)) {
      this._logger.error('_copyOrMovePath is not found.');
      return Promise.reject(new Error('_copyOrMovePath is not found.'));
    }
    const moveItemUrl = url.format({
      protocol: 'https',
      host: 'picasaweb.google.com',
      path: picasaHome.body.match(/var _copyOrMovePath = '(.*?)'/)[1]
    });

    const moveActionRes = await this._request({
      method: 'POST',
      url: moveItemUrl,
      form: {
        uname: this._userId,
        redir: '',
        dest: '',
        photoop: 'move',
        selectedphotos: itemId,
        srcAid: itemAlbumId,
        albumop: 'existing',
        aid: newAlbumId
      }
    });

    if (moveActionRes.statusCode !== 302) {
      this._logger.error('Failed to move item.');
      return Promise.reject(new Error('Failed to move item.'));
    }
  }

  async upload (filePath, fileName) {
    fileName = fileName || path.basename(filePath);

    const fileStat =
      await fs.stat(filePath)
        .catch((err) => {
          this._logger.error(`"${ fileName }" can't access.`);
          return Promise.reject(err);
        });

    const sendInfo = reqJSONTemplateGenerator();
    for (let field of sendInfo.createSessionRequest.fields) {
      if ('external' in field) {
        field.external.filename = fileName;
        field.external.size = fileStat.size;
      } else if ('inlined' in field) {
        const name = field.inlined.name;
        if (name !== 'effective_id' && name !== 'owner_name') continue;
        field.inlined.content = this._userId;
      }
    }

    const serverStatusRes = await this._request({
      method: 'POST',
      url: 'https://photos.google.com/_/upload/photos/resumable?authuser=0',
      body: JSON.stringify(sendInfo),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    });

    if (serverStatusRes.statusCode !== 200) {
      this._logger.error(`Server Error: ${ serverStatusRes.statusCode }`);
      return Promise.reject(new Error(`Server Error: ${ serverStatusRes.statusCode }`));
    }

    const serverStatus = JSON.parse(serverStatusRes.body);
    if (!('sessionStatus' in serverStatus)) {
      this._logger.error('Server Error: sessionStatus is not found.');
      return Promise.reject(new Error('Server Error: sessionStatus is not found.'));
    }

    const sendUrl =
      serverStatus.sessionStatus.externalFieldTransfers[0].putInfo.url;

    const fileReadStream = fs.createReadStream(filePath);

    if (this.options.progressbar) {
      const progressBar = new ProgressBar(colors.green('Uploading') + ' [:bar] :percent :etas', {
        complete: '=',
        incomplete: '\x20',
        width: Math.max(0, process.stdout.columns - 25),
        total: fileStat.size
      });
      fileReadStream.on('open', () => console.warn());
      fileReadStream.on('data', (chunk) => {
        progressBar.tick(chunk.length);
      });
      fileReadStream.on('end', () => console.warn());
    }

    const resultRes = await this._request({
      method: 'POST',
      url: sendUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-HTTP-Method-Override': 'PUT'
      },
      body: fileReadStream
    });

    const result = JSON.parse(resultRes.body);
    if (result.sessionStatus.state !== 'FINALIZED') {
      this._logger.error(`Upload Error: ${ result.sessionStatus.state }`);
      return Promise.reject(new Error(`Upload Error: ${ result.sessionStatus.state }`));
    }

    this._logger.info('Uploaded successfully!');

    const uploadInfo =
      result.sessionStatus
        .additionalInfo['uploader_service.GoogleRupioAdditionalInfo']
        .completionInfo
        .customerSpecificInfo;
    return uploadInfo;
  }
}

export default GPhotos;
