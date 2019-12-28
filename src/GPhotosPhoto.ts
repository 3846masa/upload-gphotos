import util from 'util';
import { isNotUndefined } from 'option-t/cjs/Undefinable';

import { Requestor } from './Requestor';

type GPhotosPhotoInfo = {
  id: string;
  type?: 'photo' | 'video' | 'animation_gif';
  uploadedAt?: Date;
  createdAt?: Date;
  title?: string;
  description?: string;
  duration?: number;
  width?: number;
  height?: number;
  fileSize?: number;
  rawUrl?: string;
};

class GPhotosPhoto {
  id: string;
  private info: GPhotosPhotoInfo;
  private requestor: Requestor;

  static parseInfo(data: any): GPhotosPhotoInfo {
    const lastIdx = data.length - 1;
    const type =
      !data[lastIdx] || typeof data[lastIdx] !== 'object'
        ? 'photo'
        : '76647426' in data[lastIdx]
        ? 'video'
        : '139842850' in data[lastIdx]
        ? 'animation_gif'
        : 'photo';

    return {
      type,
      id: data[0],
      createdAt: new Date(data[2]),
      uploadedAt: new Date(data[5]),
      duration: type === 'video' ? data[lastIdx]['76647426'][0] : undefined,
      width: type === 'video' ? data[lastIdx]['76647426'][2] : data[1][1],
      height: type === 'video' ? data[lastIdx]['76647426'][3] : data[1][2],
      rawUrl: data[1][0],
    };
  }

  constructor(info: GPhotosPhotoInfo, { requestor }: { requestor: Requestor }) {
    this.id = info.id;
    this.info = info;
    this.requestor = requestor;
  }

  async getInfo({ force }: { force: boolean } = { force: false }): Promise<Required<GPhotosPhotoInfo>> {
    if (!force && isNotUndefined(this.info.type)) {
      return this.info as Required<GPhotosPhotoInfo>;
    }

    const results = await this.requestor.sendBatchExecute<{
      fDcn4b: any;
      VrseUb: any;
    }>({
      queries: {
        fDcn4b: [this.info.id, 1],
        VrseUb: [this.info.id, null, null, true],
      },
    });

    Object.assign(
      this.info,
      {
        description: results['fDcn4b'][0][1],
        title: results['fDcn4b'][0][2],
        fileSize: results['fDcn4b'][0][5],
      },
      GPhotosPhoto.parseInfo(results['VrseUb'][0]),
    );

    return this.info as Required<GPhotosPhotoInfo>;
  }

  async delete(): Promise<void> {
    await this.requestor.sendBatchExecute({
      queries: { XwAOJf: [[], 1, [this.info.id], 3, null, [], []] },
    });
  }

  async modifyCreatedDate({ createdDate, timezoneSec }: { createdDate: Date; timezoneSec?: number }): Promise<void> {
    await this.getInfo();
    const diffTime = Math.round((createdDate.getTime() - this.info.createdAt!.getTime()) / 1000);
    await this.requestor.sendBatchExecute({
      queries: {
        DaSgWe: [[[this.info.id, null, timezoneSec || null, diffTime]]],
      },
    });
    await this.getInfo({ force: true });
  }

  async modifyDescription({ description }: { description: string }): Promise<void> {
    await this.requestor.sendBatchExecute({
      queries: {
        AQNOFd: [null, description, this.info.id],
      },
    });
    await this.getInfo({ force: true });
  }

  toJSON() {
    return this.info;
  }

  toString() {
    return `GPhotosPhoto<${JSON.stringify(this.info, null, 2)}>`;
  }

  [util.inspect.custom]() {
    return this.toString();
  }
}

export { GPhotosPhoto };
