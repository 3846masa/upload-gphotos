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
    const results = await this.gphotos
      .sendBatchExecute({
        E1Cajb: [photos.map(p => p.id), this.id],
      })
      .then(res => res['E1Cajb'])
      .catch(() => {
        // Fallback: If album is shared, use 99484733.
        return this.gphotos
          .sendBatchExecute({
            C2V01c: [[this.id], [2, null, [[photos.map(p => p.id)]], null, null, [], [1], null, null, null, []]],
          })
          .then(res => res['C2V01c']);
      });

    const insertedPhotoIds = results[1] || [];
    return insertedPhotoIds as string;
  }

  async fetchPhotoList(next?: string) {
    const { snAcKc: results } = await this.gphotos.sendBatchExecute({
      snAcKc: [this.id, next || null, null, null, 0],
    });

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
