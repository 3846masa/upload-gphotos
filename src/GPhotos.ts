import util from 'util';
import { CookieJar } from 'tough-cookie';
import { Nullable, isNotNull, isNull } from 'option-t/cjs/Nullable';
import { Maybe, isNullOrUndefined } from 'option-t/cjs/Maybe';

import { signinViaPuppeteer } from './signin_via_puppeteer';
import { Requestor } from './Requestor';
import { GPhotosPhoto } from './GPhotosPhoto';
import { GPhotosAlbum } from './GPhotosAlbum';

type LoginParams = {
  username: string;
  password: string;
};

class GPhotos {
  private requestor: Requestor;

  constructor() {
    this.requestor = new Requestor();
  }

  setCookieJar(jar: CookieJar) {
    this.requestor.jar = jar;
  }

  async signin(params: LoginParams) {
    try {
      await this.requestor.getAtToken();
    } catch (_err) {
      await signinViaPuppeteer({ ...params, jar: this.requestor.jar });
      await this.requestor.getAtToken();
    }
  }

  async fetchAlbumList({
    cursor,
  }: {
    cursor: Nullable<string>;
  }): Promise<{ results: GPhotosAlbum[]; nextCursor: Nullable<string> }> {
    const {
      Z5xsfc: [albumInfoList, nextCursor],
    } = await this.requestor.sendBatchExecute<{
      Z5xsfc: [Nullable<any[]>, Maybe<string>];
    }>({
      queries: {
        Z5xsfc: [cursor, null, null, null, 1],
      },
    });

    if (isNull(albumInfoList)) {
      return {
        results: [],
        nextCursor: null,
      };
    }

    const albumList = albumInfoList.map((data) => {
      return new GPhotosAlbum(GPhotosAlbum.parseInfo(data), {
        requestor: this.requestor,
      });
    });

    // NOTE: Cursor maybe undefined or null or empty string.
    if (isNullOrUndefined(nextCursor) || cursor === '') {
      return { results: albumList, nextCursor: null };
    }

    return { results: albumList, nextCursor };
  }

  async searchAlbum({ title }: { title: string }): Promise<Nullable<GPhotosAlbum>> {
    let cursor: Nullable<string> = null;

    do {
      const { results, nextCursor } = await this.fetchAlbumList({ cursor });
      for (const album of results) {
        const albumInfo = await album.getInfo();
        if (albumInfo.title === title) {
          return album;
        }
      }
      cursor = nextCursor as Nullable<string>;
    } while (isNotNull(cursor));

    return null;
  }

  async createAlbum({ title }: { title: string }): Promise<GPhotosAlbum> {
    const {
      results: [latestPhoto],
    } = await this.fetchPhotoList({ cursor: null });

    const {
      OXvT9d: [[albumId]],
    } = await this.requestor.sendBatchExecute<{
      OXvT9d: [[string]];
    }>({
      queries: {
        OXvT9d: [title, null, 1, [[[latestPhoto.id]]]],
      },
    });

    const album = new GPhotosAlbum(
      {
        title,
        id: albumId,
        type: 'album',
        period: { from: new Date(), to: new Date() },
        itemsCount: 0,
        isShared: false,
      },
      { requestor: this.requestor },
    );

    const {
      results: [insertedPhoto],
    } = await album.fetchPhotoList({ cursor: null });
    await album.remove(insertedPhoto);

    return album;
  }

  async fetchPhotoById({ id }: { id: string }): Promise<GPhotosPhoto> {
    const photo = new GPhotosPhoto({ id }, { requestor: this.requestor });
    await photo.getInfo();
    return photo;
  }

  async fetchPhotoList({
    cursor,
  }: {
    cursor: Nullable<string>;
  }): Promise<{ results: GPhotosPhoto[]; nextCursor: Nullable<string> }> {
    const {
      lcxiM: [photoInfoList, nextCursor],
    } = await this.requestor.sendBatchExecute<{
      lcxiM: [any[], Maybe<string>];
    }>({
      queries: {
        lcxiM: [cursor, null, null, null, 1],
      },
    });

    const photoList = photoInfoList.map((info) => {
      return new GPhotosPhoto(GPhotosPhoto.parseInfo(info), { requestor: this.requestor });
    });

    // NOTE: Cursor maybe undefined or null or empty string.
    if (isNullOrUndefined(nextCursor) || nextCursor === '') {
      return { results: photoList, nextCursor: null };
    }

    return { results: photoList, nextCursor };
  }

  async upload({
    stream,
    size,
    filename,
  }: {
    stream: NodeJS.ReadableStream;
    size: number;
    filename: string;
  }): Promise<GPhotosPhoto> {
    const data = await this.requestor.upload({ stream, size, filename });
    const photo = new GPhotosPhoto(GPhotosPhoto.parseInfo(data), { requestor: this.requestor });
    return photo;
  }

  toJSON() {
    return {};
  }

  toString() {
    return 'GPhotos';
  }

  [util.inspect.custom]() {
    return this.toString();
  }
}

export { GPhotos };
