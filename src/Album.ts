import GPhotos from './';
import Photo from './Photo';

export default class GPhotosAlbum {
  public id!: string;
  public title!: string;
  public period!: { from: Date; to: Date };
  public items_count = 0;
  public type = 'album';
  private _gphotos!: GPhotos;

  get gphotos() {
    return this._gphotos;
  }
  set gphotos(gphotos: GPhotos) {
    Object.defineProperty(this, '_gphotos', { value: gphotos });
  }

  constructor(opts: Partial<GPhotosAlbum> & { gphotos: GPhotos }) {
    Object.assign(this, opts);
  }

  async addPhoto(photo: Photo) {
    const [insertedPhotoId] = await this.addPhotos([photo]);
    return insertedPhotoId;
  }

  async addPhotos(photos: Photo[]) {
    const query = [photos.map(p => p.id), this.id];

    const results = await this.gphotos.sendMutateQuery(79956622, query).catch(() => {
      // Fallback: If album is shared, use 99484733.
      const query = [[this.id], [2, null, [[photos.map(p => p.id)]], null, null, [], []]];
      return this.gphotos.sendMutateQuery(99484733, query);
    });

    const insertedPhotoIds = results[1] || [];
    return insertedPhotoIds as string;
  }

  async fetchPhotoList(next?: string) {
    const query = [this.id, next || null, null, null, 0];
    const results = await this.gphotos.sendDataQuery(71837398, query);

    const photoList = (results[1] as any[]).map(info => {
      const data = Object.assign(Photo.parseInfo(info), { gphotos: this.gphotos });
      return new Photo(data);
    });

    return { list: photoList, next: results[2] as string | undefined };
  }

  async fetchAllPhotoList() {
    const photoList: Photo[] = [];

    let cursor: string | undefined;
    do {
      const { list, next } = await this.fetchPhotoList(cursor);
      photoList.push(...list);
      cursor = next;
    } while (cursor);

    return photoList;
  }

  async remove() {
    const query = [[this.id], []];
    await this.gphotos.sendMutateQuery(85534195, query, true);
    return true;
  }
}
