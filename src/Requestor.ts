import qs from 'querystring';
import Axios, { AxiosInstance } from 'axios';
import { CookieJar } from 'tough-cookie';
import enableCookieJar from 'axios-cookiejar-support';
import { Nullable, isNotNull, isNull } from 'option-t/cjs/Nullable';

import { USER_AGENT } from './constants';

class Requestor {
  readonly axios: AxiosInstance;
  private atToken: Nullable<string>;

  constructor() {
    this.atToken = null;
    this.axios = Axios.create({
      headers: {
        'User-Agent': USER_AGENT,
      },
      validateStatus: () => true,
      maxRedirects: 0,
      withCredentials: true,
      responseType: 'text',
      transformResponse: [(data) => data],
    });
    enableCookieJar(this.axios);
    this.jar = new CookieJar();
  }

  get jar() {
    return this.axios.defaults.jar as CookieJar;
  }

  set jar(jar: CookieJar) {
    this.axios.defaults.jar = jar;
  }

  async getAtToken(): Promise<string> {
    if (isNotNull(this.atToken)) {
      return this.atToken;
    }

    const { data, status } = await this.axios.get<string>('https://photos.google.com');
    if (status !== 200) {
      throw new Error('Your sign in attempt has failed.');
    }

    const atTokenMatches = /"SNlM0e":"(.*?)"/.exec(data);
    if (isNull(atTokenMatches)) {
      throw new Error('The token was not found.');
    }
    this.atToken = atTokenMatches[1];
    return this.atToken;
  }

  async sendBatchExecute<Result extends Record<string, any>>({
    queries,
  }: {
    queries: Record<keyof Result, any>;
  }): Promise<Result> {
    const postData = Object.entries(queries).map(([key, value]) => [key, JSON.stringify(value), null, null]);

    const { data: rawData, status, statusText } = await this.axios.request<string>({
      method: 'POST',
      url: 'https://photos.google.com/_/PhotosUi/data/batchexecute',
      data: qs.stringify({
        'f.req': JSON.stringify([postData]),
        at: await this.getAtToken(),
      }),
    });

    if (status !== 200) {
      return Promise.reject(new Error(`${statusText}`));
    }

    const results = (JSON.parse(rawData.substr(4)) as any[][]).filter(([firstValue]) => firstValue === 'wrb.fr');

    const error = results.find((entry) => Array.isArray(entry[entry.length - 2]));
    if (error !== undefined) {
      throw new Error(`Error batchexecute (error: ${error[error.length - 2][0]}, query: ${error[1]})`);
    }

    return results.reduce<Result>((obj, [, key, raw]) => Object.assign(obj, { [key]: JSON.parse(raw) }), {} as any);
  }

  async upload({
    stream,
    size,
    filename,
  }: {
    stream: NodeJS.ReadableStream;
    size: number;
    filename: string;
  }): Promise<any> {
    stream.pause();

    const serverStatusRes = await this.axios.post<string>(
      'https://photos.google.com/_/upload/uploadmedia/interactive',
      '',
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-File-Name': encodeURIComponent(filename),
          'X-Goog-Upload-Raw-Size': size,
          'X-Goog-Upload-Header-Content-Length': size,
          'X-Goog-Upload-Protocol': 'resumable',
        },
      },
    );

    if (serverStatusRes.status !== 200) {
      throw new Error(`Server Error: ${serverStatusRes.status}`);
    }

    const sendUrl = serverStatusRes.headers['x-goog-upload-url'];

    const resultRes = await this.axios.post<ArrayBuffer>(sendUrl, stream, {
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Goog-Upload-Command': 'upload, finalize',
        'X-Goog-Upload-File-Name': encodeURIComponent(filename),
        'X-Goog-Upload-Offset': 0,
      },
    });

    if (resultRes.headers['x-goog-upload-status'] !== 'final') {
      throw new Error('Failed to upload.');
    }

    const uploadToken = (() => {
      const str = Buffer.from(resultRes.data).toString();
      if (/^[A-Za-z0-9+/=]+$/.test(str)) {
        return str;
      }
      return Buffer.from(resultRes.data).toString('base64');
    })();

    const {
      mdpdU: [[[, photoInfoData]]],
    } = await this.sendBatchExecute<{
      mdpdU: [[[unknown, any]]];
    }>({
      queries: {
        mdpdU: [[[uploadToken, filename, Date.now()]]],
      },
    });

    return photoInfoData;
  }
}

export { Requestor };
