import packageInfo from '../package.json';
import reqJSONTemplateGenerator from './utils/request-json-template-generator';

// import winston, { Logger } from 'winston';
// import log4js from 'log4js';
import request from 'request-promise';
import fs from 'fs-promise';
import ProgressBar from 'progress';
import path from 'path';
import colors from 'colors/safe';
import qs from 'querystring';
import cheerio from 'cheerio';
import { JSDOM, VirtualConsole } from 'jsdom';
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
   *     logger: new wiston.Logger();,
   *     fromCli : false
   *   }
   * });
   * @param  {Object} params
   * @param  {String} params.username
   * @param  {String} params.password
   * @param  {Object} [params.options]
   * @param  {boolean} [params.options.progressbar]
   * @param  {winston.Logger|log4js.Logger|console} [params.options.logger]
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
        value: this.options.logger || console
      },
      '_gphotos': {
        value: this
      }
    });
  }


  /**
   * 
   * @param {string} message 
   * @returns {Promise<undefined,Error>}
   * 
   */
  async _errorHandler(message){
    this._logger.error(message);
    return Promise.reject(new Error(message));
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
    await this._preLogin();
    const params = await this._fetchGPhotosParams();
    if (!params.S06Grb) {
      return Promise.reject(new Error('Can\'t fetch userId.'));
    }
    this._userId = params.S06Grb;

    this._logger.info('Success to login!');
    this._logger.info(`UserID is ${ this._userId }.`);

    await this.fetchAtParam();

    return this;
  }


  /**
   * 
   * @returns 
   * 
   */
  async _preLogin() {
    const loginUrl = 'https://accounts.google.com/ServiceLoginAuth';
    const { body: loginHTML } = await this._request.get(loginUrl);

    const loginData = Object.assign(
      qs.parse(cheerio.load(loginHTML)('form').serialize()),
      {
        Email: this.username,
        Passwd: this.password
      }
    );

    const loginRes = await this._request.post(loginUrl, { form: loginData });

    if (loginRes.statusCode !== 302) {
      return this._errorHandler('Failed to login');
    }

    const urlFound = cheerio.load(loginRes.body)('a').attr('href');

    if (this._isChallengedUrl(urlFound)){
      return this._errorHandler('There is a challenge request, please use cli to solve it (eg: ./upload-gphotos -c -u xxx -p xxx)');
    }
    return urlFound;
  }

  
  /**
   * 
   * @returns {boolean} true if there i
   * 
   */
  async findSMSChallenge() {
    const urlFound = await this._preLogin();
    if (this._isChallengedUrl(urlFound)){
      await this._getSMSChallenge(urlFound);
      return true;
    }else{
      this._logger.info('Great news, no challenge to solve !');
      return false;
    }
  }

  /**
   * @param  {string} url
   */
  _isChallengedUrl(url){
    return url.toLowerCase().indexOf('/checkcookie') === -1;
  }
  
  /**
   * @param  {node} $ (full document)
   * @param  {node} $form (form node)
   */
  _getFullFormActionUrl($, $form){
    return $('base').first().attr('href').replace(/\/$/g, '') + $form.attr('action');
  }
  
  /**
   * @param {any} challengeUrl 
   */
  async _getSMSChallenge(challengeUrl){
    let challengeReq = await this._request.get(challengeUrl);

    if (challengeReq.statusCode !== 200){
      return this._errorHandler('Can\'t handle challenge.');
    }

    let $ = cheerio.load(challengeReq.body);
    const $form = $('form').first();
    const sendTo = this._getFullFormActionUrl($, $form);
    let challengeData = Object.assign(qs.parse($form.serialize()), {SendMethod: 'SMS'});
    const challengeRes = await this._request.post(sendTo, { form: challengeData });

    if (challengeRes.statusCode !== 200) {
      return this._errorHandler('Failed to get SMS for challenge');
    }

    this._logger.info('SMS is sent to :', $form.find('b').text());
    this._challengeRes = challengeRes;
  }

  /**
   * @param  {string} pin code received by SMS
   */
  async sendPinFromSMS(pin){
    if (this._challengeRes){
      const $ = cheerio.load(this._challengeRes.body);
      const $form = $('form').first();
      const smsFormData = Object.assign(qs.parse($form.serialize()), {Pin:pin});

      delete smsFormData.SendMethod;

      const sendTo = this._getFullFormActionUrl($, $form);
      const smsFormRes = await this._request.post(sendTo, { form: smsFormData });
      
      if (smsFormRes.statusCode !== 200) {
        return this._errorHandler('Failed to send SMS');
      }

      this._logger.info('Done, You\'re all set !');
    }else{
      this._logger.error('Oops, No challenge found :(');
    }
  }

  /**
   * @return {Promise<undefined,Error>}
   */
  async fetchAtParam () {
    const params = await this._fetchGPhotosParams();
    if (!params.SNlM0e) {
      return Promise.reject(new Error('Can\'t fetch "at" param.'));
    }

    this._atParam = params.SNlM0e;
    this._logger.info(`atParam is ${ this._atParam }.`);
  }

  async _fetchGPhotosParams () {
    const gPhotosTopPageRes = await this._request.get('https://photos.google.com');
    if (gPhotosTopPageRes.statusCode !== 200) {
      this._logger.error('Can\'t access to Google Photos');
      return Promise.reject(new Error('Can\'t access to Google Photos'));
    }

    const window = new JSDOM(gPhotosTopPageRes.body, {
      virtualConsole: new VirtualConsole(),
      runScripts: 'dangerously',
    }).window;
    if (window.WIZ_global_data && window.WIZ_global_data.SNlM0e) {
      const params = window.WIZ_global_data;
      window.close();
      return params;
    } else {
      return Promise.reject(new Error('Can\'t fetch GPhotos params.'));
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

    if (!results[0]) {
      return { list: [], next: undefined };
    }

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
        _gphotos: this._gphotos
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

    await new Photo({ id: insertedPhotoId, _gphotos: this._gphotos }).removeFromAlbum();

    this._logger.info(`AlbumID is ${ albumId }.`);

    const album = await this.searchAlbum(albumId);
    return album;
  }

  /**
   * @param {String} id
   * @return {Promise<GPhotosPhoto,Error>}
   */
  async fetchPhotoById (id) {
    const photo = new Photo({ id: id, _gphotos: this });
    return await photo.fetchInfo();
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

    const photoList = results[0].map((info) => {
      const data = Object.assign(Photo.parseInfo(info), { _gphotos: this._gphotos });
      return new Photo(data);
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

  async _sendMutateQuery (queryNum, query, ignoreResult = false) {
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

    if (ignoreResult) return true;

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
    const fileReadStream = fs.createReadStream(filePath);
    return await this.uploadFromStream(fileReadStream, fileStat.size, fileName);
  }

  /**
   * @param {stream.Readable} stream
   * @param {number} size
   * @param {?String} [fileName]
   * @return {Promise<GPhotosPhoto,Error>}
   */
  async uploadFromStream (stream, size, fileName) {
    stream.pause();

    if (!size || typeof size !== 'number') {
      throw new Error('Invalid arguments.');
    }

    const sendInfo = reqJSONTemplateGenerator();
    for (let field of sendInfo.createSessionRequest.fields) {
      if ('external' in field) {
        field.external.filename = fileName || Date.now().toString(10);
        field.external.size = size;
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

    if (this.options.progressbar) {
      const progressBar = new ProgressBar(colors.green('Uploading') + ' [:bar] :percent :etas', {
        complete: '=',
        incomplete: '\x20',
        width: Math.max(0, process.stdout.columns - 25),
        total: size
      });
      stream.on('open', () => process.stderr.write('\n'));
      stream.on('data', (chunk) => {
        progressBar.tick(chunk.length);
      });
      stream.on('end', () => process.stderr.write('\n'));
    }

    const resultRes = await this._request({
      method: 'POST',
      url: sendUrl,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-HTTP-Method-Override': 'PUT'
      },
      body: stream
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
      description: uploadInfo.description,
      rawUrl: uploadInfo.url,
      uploadInfo: uploadInfo,
      _gphotos: this._gphotos
    });
    return uploadedPhoto;
  }
}

export default GPhotos;
