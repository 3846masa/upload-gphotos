import * as fs from 'fs-extra';
import * as libpath from 'path';
import * as qs from 'querystring';
import * as cheerio from 'cheerio';
import * as tough from 'tough-cookie';
import * as ProgressBar from 'progress';
import * as colors from 'colors';
import { JSDOM, VirtualConsole, DOMWindow as _DOMWindow } from 'jsdom';
import Axios, { AxiosInstance } from 'axios';
import cookieJarSupport = require('@3846masa/axios-cookiejar-support');

import uploadInfoTemplate from './util/uploadInfoTemplate';
import Album from './Album';
import Photo from './Photo';

const packageInfo = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));

export interface GPhotosConstructorParams {
  username?: string;
  password?: string;
  options?: Partial<GPhotosOptions>;
}

export interface GPhotosOptions {
  progress: boolean;
  jar: tough.CookieJar;
}

export interface GPhotosParams {
  at: string;
  userId: string;
}

interface DOMWindow extends _DOMWindow {
  WIZ_global_data?: {
    SNlM0e?: string;
    S06Grb?: string;
  };
}

class GPhotos {
  private username?: string;
  private password?: string;
  private options: GPhotosOptions;
  private axios: AxiosInstance;
  private params: GPhotosParams;

  /**
   * @example
   * ```js
   * const gphotos = new GPhotos({
   *   username: 'username@gmail.com',
   *   password: 'YOUR_PASSWORD',
   *   options: {
   *     progress: true,
   *   }
   * });
   * ```
   */
  constructor(params: GPhotosConstructorParams) {
    const { username, password, options = {} } = params;
    this.username = username;
    this.password = password;
    const defaultOptions = { silence: true, progress: false, jar: new tough.CookieJar() };
    this.options = Object.assign(defaultOptions, options);
    this.axios = cookieJarSupport(
      Axios.create({
        headers: {
          'User-Agent': `Mozilla/5.0 UploadGPhotos/${packageInfo.version}`,
        },
        validateStatus: () => true,
        maxRedirects: 0,
        jar: this.options.jar,
        withCredentials: true,
        responseType: 'text',
      })
    );
  }

  /** @private */
  async sendDataQuery(queryNum: number, query: any) {
    const reqQuery = [
      [
        [
          queryNum,
          [
            {
              [String(queryNum)]: query,
            },
          ],
          null,
          null,
          0,
        ],
      ],
    ];

    const url = 'https://photos.google.com/_/PhotosUi/data';
    const body = await this.sendQuery(url, reqQuery);

    const results = JSON.parse(body.substr(4))[0][2][String(queryNum)];
    return results;
  }

  /** @private */
  async sendMutateQuery(queryNum: number, query: any, ignoreResult = false) {
    const reqQuery = [
      'af.maf',
      [
        [
          'af.add',
          queryNum,
          [
            {
              [String(queryNum)]: query,
            },
          ],
        ],
      ],
    ];

    const url = 'https://photos.google.com/_/PhotosUi/mutate';
    const body = await this.sendQuery(url, reqQuery);

    if (ignoreResult) return true;

    const results = JSON.parse(body.substr(4))[0][1][String(queryNum)];
    return results;
  }

  /** @private */
  async sendQuery(url: string, query: any) {
    const queryRes = await this.axios.request({
      method: 'POST',
      url: url,
      data: qs.stringify({
        'f.req': JSON.stringify(query),
        at: this.params.at,
      }),
      responseType: 'text',
    });

    if (queryRes.status !== 200) {
      return Promise.reject(new Error(`${queryRes.statusText}`));
    }

    return queryRes.data;
  }

  /**
   * @example
   * ```js
   * gphotos.login()
   *   .then((gphotos) => {
   *     // do something
   *   })
   *   .catch((err) => {
   *     console.error(err.stack);
   *   });
   * ```
   */
  async login() {
    const params = await this.fetchParams().catch(async () => {
      await this.postLogin();
      return this.fetchParams();
    });
    this.params = params;
    return this;
  }

  /** @private */
  async postLogin() {
    const { data: loginHTML } = await this.axios.get('https://accounts.google.com/ServiceLogin');

    const loginData = Object.assign(qs.parse(cheerio.load(loginHTML)('form').serialize()), {
      Email: this.username,
      Passwd: this.password,
    });

    const loginRes = await this.axios.post(
      'https://accounts.google.com/signin/challenge/sl/password',
      qs.stringify(loginData)
    );

    if (loginRes.status !== 302) {
      return Promise.reject(new Error('Failed to login'));
    }
    return;
  }

  /** @private */
  async fetchParams() {
    const gPhotosTopPageRes = await this.axios.get('https://photos.google.com');
    if (gPhotosTopPageRes.status !== 200) {
      return Promise.reject(new Error("Can't access to Google Photos"));
    }

    const window: DOMWindow = new JSDOM(gPhotosTopPageRes.data, {
      virtualConsole: new VirtualConsole(),
      runScripts: 'dangerously',
    }).window;

    if (!window.WIZ_global_data || !window.WIZ_global_data.SNlM0e || !window.WIZ_global_data.S06Grb) {
      return Promise.reject(new Error("Can't fetch GPhotos params."));
    }

    const params = {
      at: window.WIZ_global_data.SNlM0e,
      userId: window.WIZ_global_data.S06Grb,
    };
    window.close();
    return params;
  }

  async searchAlbum(albumName: string | number) {
    albumName = `${albumName}`;
    const checkFilter = (info: Album) => {
      return info.title === albumName || info.id === albumName;
    };

    let albumInfo: Album | undefined;
    let cursor: string | undefined;
    do {
      const { list, next } = await this.fetchAlbumList(cursor);
      albumInfo = list.filter(checkFilter).shift();
      cursor = next;
    } while (!albumInfo && cursor);

    if (!albumInfo) {
      throw new Error(`Album "${albumName}" is not found.`);
    }
    return albumInfo;
  }

  async fetchAllAlbumList() {
    const albumList: Album[] = [];

    let cursor: string | undefined;
    do {
      const { list, next } = await this.fetchAlbumList(cursor);
      albumList.push(...list);
      cursor = next;
    } while (cursor);

    return albumList;
  }

  async fetchAlbumList(next?: string): Promise<{ list: Album[]; next?: string }> {
    const query = [next || null, null, null, null, 1];
    const results = await this.sendDataQuery(72930366, query);

    if (!results[0]) {
      return { list: [], next: undefined };
    }

    const albumList = (results[0] as any[]).map(al => {
      const info = al.pop()['72930366'];
      return new Album({
        id: al.shift(),
        title: info[1],
        period: {
          from: new Date(info[2][0]),
          to: new Date(info[2][1]),
        },
        items_count: info[3],
        gphotos: this,
      });
    });

    return { list: albumList, next: results[1] as string };
  }

  async createAlbum(albumName: string) {
    const latestPhoto = await this.fetchLatestPhoto();
    const query = [[latestPhoto.id], null, albumName.toString()];

    const results = await this.sendMutateQuery(79956622, query);

    const [albumId, [insertedPhotoId]] = results;

    await new Photo({ id: insertedPhotoId, gphotos: this }).removeFromAlbum();

    const album = await this.searchAlbum(albumId);
    return album;
  }

  async fetchPhotoById(id: string) {
    const photo = new Photo({ id: id, gphotos: this });
    return await photo.fetchInfo();
  }

  async fetchAllPhotoList() {
    const photoList = [];

    let cursor: string | undefined;
    do {
      const { list, next } = await this.fetchPhotoList(cursor);
      photoList.push(...list);
      cursor = next;
    } while (cursor);

    return photoList;
  }

  async fetchPhotoList(next?: string) {
    const query = [next || null, null, null, null, 1];
    const results = await this.sendDataQuery(74806772, query);

    if (!results[0]) {
      return { list: [], next: undefined };
    }

    const photoList = (results[0] as any[]).map(info => {
      const data = Object.assign(Photo.parseInfo(info), { gphotos: this });
      return new Photo(data);
    });

    return { list: photoList, next: results[1] as string };
  }

  async fetchLatestPhoto() {
    const latestPhotoList = await this.fetchPhotoList();
    return latestPhotoList.list[0];
  }

  async searchOrCreateAlbum(albumName: string) {
    return this.searchAlbum(albumName).then(album => album || this.createAlbum(albumName));
  }

  async upload(filePath: string, _fileName?: string) {
    const fileName = _fileName || libpath.basename(filePath);
    const fileStat = await fs.stat(filePath);
    const fileReadStream = fs.createReadStream(filePath);
    return await this.uploadFromStream(fileReadStream, fileStat.size, fileName);
  }

  async uploadFromStream(stream: NodeJS.ReadableStream, size: number, fileName?: string) {
    stream.pause();

    const sendInfo = uploadInfoTemplate();
    for (let field of sendInfo.createSessionRequest.fields) {
      if (field.external) {
        field.external.filename = fileName || Date.now().toString(10);
        field.external.size = size;
      } else if (field.inlined) {
        const name = field.inlined.name;
        if (name !== 'effective_id' && name !== 'owner_name') continue;
        field.inlined.content = this.params.userId;
      }
    }

    const serverStatusRes = await this.axios.request({
      method: 'POST',
      url: 'https://photos.google.com/_/upload/photos/resumable?authuser=0',
      data: JSON.stringify(sendInfo),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      responseType: 'json',
    });

    if (serverStatusRes.status !== 200) {
      return Promise.reject(new Error(`Server Error: ${serverStatusRes.status}`));
    }

    const serverStatus = serverStatusRes.data;
    if (!('sessionStatus' in serverStatus)) {
      return Promise.reject(new Error('Server Error: sessionStatus is not found.'));
    }

    const sendUrl = serverStatus.sessionStatus.externalFieldTransfers[0].putInfo.url;

    if (this.options.progress) {
      const progressBar = new ProgressBar(`${colors.green('Uploading')} [:bar] :percent :etas`, {
        total: size,
      });
      stream.on('open', () => process.stderr.write('\n'));
      stream.on('data', chunk => {
        progressBar.tick(chunk.length);
      });
      stream.on('end', () => process.stderr.write('\n'));
    }

    const resultRes = await this.axios.request({
      method: 'POST',
      url: sendUrl,
      data: stream,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-HTTP-Method-Override': 'PUT',
      },
      responseType: 'json',
    });

    const result = resultRes.data;
    if (result.sessionStatus.state !== 'FINALIZED') {
      return Promise.reject(new Error(`Upload Error: ${result.sessionStatus.state}`));
    }

    const uploadInfo =
      result.sessionStatus.additionalInfo['uploader_service.GoogleRupioAdditionalInfo'].completionInfo
        .customerSpecificInfo;

    const uploadedPhoto = new Photo({
      id: uploadInfo.photoMediaKey,
      uploadedAt: new Date(),
      createdAt: new Date(uploadInfo.timestamp * 1000),
      type: uploadInfo.kind,
      title: uploadInfo.title,
      description: uploadInfo.description,
      rawUrl: uploadInfo.url,
      uploadInfo: uploadInfo,
      gphotos: this,
    });
    return uploadedPhoto;
  }
}

export default GPhotos;
