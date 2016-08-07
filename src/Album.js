import JSON from './utils/json-async';

import Photo from './Photo';

class GPhotosAlbum {
  constructor ({
    id, title, period = { from: new Date(0), to: new Date(0) },
    items_count = 0, _parent
  }) {
    this.id = id;
    this.title = title;
    this.period = period;
    this.items_count = items_count;
    this.type = 'album';
    this._gphotos = _parent;
    this._request = this._gphotos._request;
    this._logger = this._gphotos._logger;
  }

  async addPhoto (photo) {
    const [ insertedPhotoId ] = await this.addPhotos([ photo ]);
    return insertedPhotoId;
  }

  async addPhotos (photos) {
    const reqQuery = [
      'af.maf',
      [[
        'af.add',
        79956622,
        [{
          '79956622': [ photos.map((p) => p.id), this.id ]
        }]
      ]]
    ];

    const queryRes = await this._request({
      method: 'POST',
      url: 'https://photos.google.com/_/PhotosUi/mutate',
      form: {
        'f.req': JSON.stringify(reqQuery),
        at: this._gphotos._atParam
      }
    });

    if (queryRes.statusCode !== 200) {
      this._logger.error(`Failed to add photo in album. ${queryRes.statusMessage}`);
      return Promise.reject(new Error(`Failed to add photo in album. ${queryRes.statusMessage}`));
    }

    const insertedPhotoIds =
      (await JSON.parseAsync(queryRes.body.substr(4)))[0][1]['79956622'][1];
    return insertedPhotoIds;
  }

  async fetchPhotoList (next = null) {
    const reqQuery = [[
      [ 71837398, [{
        '71837398': [ this.id, (next || null), null, null, 0 ]
      }], null, null, 0]
    ]];
    const photoRes = await this._request({
      method: 'POST',
      url: 'https://photos.google.com/_/PhotosUi/data',
      form: {
        'f.req': JSON.stringify(reqQuery),
        at: this._atParam
      }
    });

    if (photoRes.statusCode !== 200) {
      return { list: [], next: undefined };
    }

    const results =
      (await JSON.parseAsync(photoRes.body.substr(4)))[0][2]['71837398'];

    const photoList = results[1].map((al) => {
      const type = (al[1].pop()[0] === 15658734) ? 'video' : 'photo';
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

    return { list: photoList, next: results[2] || null };
  }
}

export default GPhotosAlbum;
