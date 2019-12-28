import util from 'util';
import { Nullable } from 'option-t/cjs/Nullable';

import { Requestor } from './Requestor';
import { GPhotosPhoto } from './GPhotosPhoto';

type GPhotosAlbumInfo = {
  id: string;
  type: 'album';
  title?: string;
  period?: { from: Date; to: Date };
  itemsCount?: number;
  isShared?: boolean;
};

class GPhotosAlbum {
  id: string;
  private info: GPhotosAlbumInfo;
  private requestor: Requestor;

  static parseInfo(data: any): GPhotosAlbumInfo {
    const info = data.pop()['72930366'];
    return {
      id: data.shift(),
      type: 'album',
      title: info[1],
      period: {
        from: new Date(info[2][0]),
        to: new Date(info[2][1]),
      },
      itemsCount: info[3],
      isShared: info[4] === true,
    };
  }

  constructor(info: GPhotosAlbumInfo, { requestor }: { requestor: Requestor }) {
    this.id = info.id;
    this.info = info;
    this.requestor = requestor;
  }

  async getInfo(): Promise<Required<GPhotosAlbumInfo>> {
    return this.info as Required<GPhotosAlbumInfo>;
  }

  async append(...photoList: GPhotosPhoto[]): Promise<void> {
    if (this.info.isShared) {
      await this.requestor.sendBatchExecute({
        queries: {
          C2V01c: [[this.id], [2, null, [[photoList.map((p) => p.id)]], null, null, [], [1], null, null, null, []]],
        },
      });
    } else {
      await this.requestor.sendBatchExecute({
        queries: {
          E1Cajb: [photoList.map((p) => p.id), this.id],
        },
      });
    }
  }

  async remove(photo: GPhotosPhoto): Promise<void> {
    await this.requestor.sendBatchExecute({
      queries: { ycV3Nd: [[photo.id], []] },
    });
  }

  async fetchPhotoList({
    cursor,
  }: {
    cursor: Nullable<string>;
  }): Promise<{ results: GPhotosPhoto[]; nextCursor: Nullable<string> }> {
    const {
      snAcKc: [, photoInfoList, nextCursor],
    } = await this.requestor.sendBatchExecute<{
      snAcKc: [unknown, any[], Nullable<string>];
    }>({
      queries: {
        snAcKc: [this.id, cursor, null, null, 0],
      },
    });

    const photoList = photoInfoList.map((info) => {
      return new GPhotosPhoto(GPhotosPhoto.parseInfo(info), { requestor: this.requestor });
    });

    return { results: photoList, nextCursor };
  }

  async delete(): Promise<void> {
    await this.requestor.sendBatchExecute({
      queries: { nV6Qv: [[this.id], []] },
    });
  }

  toJSON() {
    return this.info;
  }

  toString() {
    return `GPhotosAlbum<${JSON.stringify(this.info, null, 2)}>`;
  }

  [util.inspect.custom]() {
    return this.toString();
  }
}

export { GPhotosAlbum };
