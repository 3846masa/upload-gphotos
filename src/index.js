import packageInfo from '../package.json';
import reqJSONTemplateGenerator from './utils/request-json-template-generator';

// import winston, { Logger } from 'winston';
import log4js from 'log4js';
import request from 'request-promise';
import fs from 'fs-promise';
import ProgressBar from 'progress';
import path from 'path';
import colors from 'colors/safe';
import jsdom from './utils/jsdom-async';
import JSON from './utils/json-async';

import Album from './Album';
import Photo from './Photo';

class GPhotos {
  /**
   * @external {winston.Logger} https://github.com/winstonjs/winston
   */
  /**
   * @external {log4js.Logger} https://github.com/nomiddlename/log4js-node
   */
  /**
   * @example
   * const gphotos = new GPhotos({
   *   username: 'username@gmail.com',
   *   password: 'YOUR_PASSWORD',
   *   options: {
   *     progressbar: true,
   *     logger: new wiston.Logger();
   *   }
   * });
   * @param  {Object} params
   * @param  {String} params.username
   * @param  {String} params.password
   * @param  {Object} [params.options]
   * @param  {boolean} [params.options.progressbar]
   * @param  {winston.Logger|log4js.Logger} [params.options.logger]
   */
  constructor ({ username, password, options }) {
    /** @type {String} */
    this.username = username;
    /** @type {String} */
    this.password = password;
    /** @type {Object} */
    this.options = options || {};

    const cookieJar = request.jar();
    Object.defineProperties(this, {
      '_cookieJar': {
        value: cookieJar
      },
      '_request': {
        value: request.defaults({
          simple: false,
          resolveWithFullResponse: true,
          headers: {
            'User-Agent': `Mozilla/5.0 UploadGPhotos/${ packageInfo.version }`
          },
          jar: cookieJar
        })
      },
      '_logger': {
        value: this.options.logger || log4js.getLogger()
      }
    });
  }

  /**
   * @example
   * gphotos.login()
   *   .then((gphotos) => {
   *     // do something
   *   })
   *   .catch((err) => {
   *     console.error(err.stack);
   *   });
   * @return {Promise<GPhotos,Error>}
   */
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

    const gplusRes = await this._request.head('https://plus.google.com/u/0/me');
    this._userId = gplusRes.request.uri.href.split('/').reverse()[0];

    if (!String(this._userId).match(/^\d+$/)) {
      this._logger.error('Failed to login...');
      this._logger.warn('Tips: Before to login, you should setup Google+.');
      return Promise.reject(new Error('Failed to login'));
    }

    this._logger.info('Success to login!');
    this._logger.info(`UserID is ${ this._userId }.`);

    await this.fetchAtParam();

    return this;
  }

  /**
   * @return {Promise<undefined,Error>}
   */
  async fetchAtParam () {
    const gPhotosTopPageRes = await this._request.get('https://photos.google.com');
    if (gPhotosTopPageRes.statusCode !== 200) {
      this._logger.error('Can\'t access to Google Photos');
      return Promise.reject(new Error('Can\'t access to Google Photos'));
    }

    this._atParam = await this._generateAtParamFromHTMLAsync(gPhotosTopPageRes.body);
    this._logger.info(`atParam is ${ this._atParam }.`);
  }

  async _generateAtParamFromHTMLAsync (html) {
    const window = await jsdom.envAsync(html);
    if (window.WIZ_global_data && window.WIZ_global_data.SNlM0e) {
      const atParam = window.WIZ_global_data.SNlM0e;
      window.close();
      return atParam;
    } else {
      return Promise.reject(new Error('Can\'t generate "at" param.'));
    }
  }

  /**
   * @param  {String} albumName
   * @return {Promise<GPhotosAlbum,Error>}
   */
  async searchAlbum (albumName) {
    albumName = albumName.toString();

    let albumInfo = null;
    let cursor = null;
    const checkFilter = (info) => {
      return info.title === albumName ||
        info.id === albumName;
    };

    do {
      const { list: albumList, next: nextCursor } =
        await this.fetchAlbumList(cursor);

      albumInfo = albumList.filter(checkFilter).shift();
      cursor = nextCursor;
    } while (!albumInfo && cursor);

    if (!albumInfo) {
      this._logger.error(`Album "${ albumName }" is not found.`);
      return null;
    }
    return albumInfo;
  }

  /**
   * @return {Promise<GPhotosAlbum[],Error>}
   */
  async fetchAllAlbumList () {
    const albumList = [];

    let cursor = null;
    do {
      const { list, next: nextCursor } = await this.fetchAlbumList(cursor);
      albumList.push(...list);
      cursor = nextCursor;
    } while (cursor);

    return albumList;
  }

  /**
   * @param  {?String} [next=null]
   * @return {Promise<Object,Error>}
   * @property {GPhotosAlbum[]} list
   * @property {String|undefined} next
   */
  async fetchAlbumList (next = null) {
    const query = [ (next || null), null, null, null, 1 ];
    const results =
      await this._sendDataQuery(72930366, query)
        .catch((_err) => {
          this._logger.error(`Failed to fetch albums. ${_err.message}`);
          return Promise.reject(_err);
        });

    const albumList = results[0].map((al) => {
      const info = al.pop()['72930366'];
      return new Album({
        id: al.shift(),
        title: info[1],
        period: {
          from: new Date(info[2][0]),
          to: new Date(info[2][1])
        },
        items_count: info[3],
        _parent: this
      });
    });

    return { list: albumList, next: results[1] };
  }

  /**
   * @param  {String} albumName
   * @return {Promise<GPhotosAlbum,Error>}
   */
  async createAlbum (albumName) {
    const latestPhoto = await this._fetchLatestPhoto();
    const query = [ [ latestPhoto.id ], null, albumName ];

    const results =
      await this._sendMutateQuery(79956622, query)
        .catch((_err) => {
          this._logger.error(`Failed to create album. ${_err.message}`);
          return Promise.reject(_err);
        });

    const [ albumId, [ insertedPhotoId ] ] = results;

    await new Photo({ id: insertedPhotoId, _parent: this}).removeFromAlbum();

    this._logger.info(`AlbumID is ${ albumId }.`);
    return new Album({
      id: albumId,
      title: albumName,
      _parent: this
    });
  }

  /**
   * @return {Promise<GPhotosPhoto[],Error>}
   */
  async fetchAllPhotoList () {
    const photoList = [];

    let cursor = null;
    do {
      const { list, next: nextCursor } = await this.fetchPhotoList(cursor);
      photoList.push(...list);
      cursor = nextCursor;
    } while (cursor);

    return photoList;
  }

  /**
   * @param  {?String} [next=null]
   * @return {Promise<Object,Error>}
   * @property {GPhotosPhoto[]} list
   * @property {String|undefined} next
   */
  async fetchPhotoList (next = null) {
    const query = [ (next || null), null, null, null, 1 ];
    const results =
      await this._sendDataQuery(74806772, query)
        .catch((_err) => {
          this._logger.error(`Failed to fetch photos. ${_err.message}`);
          return Promise.reject(_err);
        });

    const photoList = results[0].map((al) => {
      const type = (!al[9]) ? 'photo' : 'video';
      return new Photo({
        id: al[0],
        createdAt: al[2],
        uploadedAt: al[5],
        type: type,
        length: (type === 'video') ? al[9]['76647426'][0] : null,
        width: (type === 'photo') ? al[1][1] : al[9]['76647426'][2],
        height: (type === 'photo') ? al[1][2] : al[9]['76647426'][3],
        rawUrl: al[1][0],
        _parent: this
      });
    });

    return { list: photoList, next: results[1] };
  }

  async _fetchLatestPhoto () {
    const latestPhotoList = await this.fetchPhotoList();
    return latestPhotoList.list[0];
  }

  /**
   * @param  {String} albumName
   * @return {Promise<GPhotosAlbum,Error>}
   */
  async searchOrCreateAlbum (albumName) {
    return this.searchAlbum(albumName)
      .then((album) => album || this.createAlbum(albumName));
  }

  async _sendDataQuery (queryNum, query) {
    const reqQuery = [[
      [ parseInt(queryNum, 10), [{
        [String(queryNum)]: query
      }], null, null, 0]
    ]];

    const url = 'https://photos.google.com/_/PhotosUi/data';
    const body = await this._sendQuery(url, reqQuery);

    const results =
      (await JSON.parseAsync(body.substr(4)))[0][2][String(queryNum)];
    return results;
  }

  async _sendMutateQuery (queryNum, query) {
    const reqQuery = [
      'af.maf',
      [[
        'af.add',
        parseInt(queryNum, 10),
        [{
          [String(queryNum)]: query
        }]
      ]]
    ];

    const url = 'https://photos.google.com/_/PhotosUi/mutate';
    const body = await this._sendQuery(url, reqQuery);

    const results =
      (await JSON.parseAsync(body.substr(4)))[0][1][String(queryNum)];
    return results;
  }

  async _sendQuery (url, query) {
    const queryRes = await this._request({
      method: 'POST',
      url: url,
      form: {
        'f.req': JSON.stringify(query),
        at: this._atParam
      }
    });

    if (queryRes.statusCode !== 200) {
      return Promise.reject(new Error(`${queryRes.statusMessage}`));
    }

    return queryRes.body;
  }

  /**
   * @param  {String} filePath
   * @param  {?String} [fileName]
   * @return {Promise<GPhotosPhoto,Error>}
   */
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
      fileReadStream.on('open', () => process.stderr.write('\n'));
      fileReadStream.on('data', (chunk) => {
        progressBar.tick(chunk.length);
      });
      fileReadStream.on('end', () => process.stderr.write('\n'));
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

    const uploadedPhoto = new Photo({
      id: uploadInfo.photoMediaKey,
      uploadedAt: new Date(),
      createdAt: uploadInfo.timestamp * 1000,
      type: uploadInfo.kind,
      title: uploadInfo.title,
      rawUrl: uploadInfo.url,
      uploadInfo: uploadInfo,
      _parent: this
    });
    return uploadedPhoto;
  }
}

export default GPhotos;
