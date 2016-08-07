import Photo from './Photo';

class GPhotosAlbum {
  /**
   * @ignore
   */
  constructor ({
    id, title, period = { from: new Date(0), to: new Date(0) },
    items_count = 0, _parent
  }) {
    /** @type {String} */
    this.id = id;
    /** @type {String} */
    this.title = title;
    /**
     * @type {Object}
     * @property {Date} from
     * @property {Date} to
     */
    this.period = period;
    /** @type {number} */
    this.items_count = items_count;
    /** @type {String} */
    this.type = 'album';

    Object.defineProperties(this, {
      '_gphotos': {
        value: _parent
      },
      '_logger': {
        value: _parent._logger
      }
    });
  }

  /**
   * @param {GPhotosPhoto} photo
   * @return {Promise<String,Error>}
   */
  async addPhoto (photo) {
    const [ insertedPhotoId ] = await this.addPhotos([ photo ]);
    return insertedPhotoId;
  }

  /**
   * @param {GPhotosPhoto[]} photos
   * @return {Promise<String[],Error>}
   */
  async addPhotos (photos) {
    const query = [ photos.map((p) => p.id), this.id ];

    const results =
      await this._gphotos._sendMutateQuery(79956622, query)
        .catch((_err) => {
          this._logger.error(`Failed to add photo in album. ${_err.message}`);
          return Promise.reject(_err);
        });

    const insertedPhotoIds = results[1];
    return insertedPhotoIds;
  }

  /**
   * @param  {?String} [next=null]
   * @return {Promise<Object,Error>}
   * @property {GPhotosPhoto[]} list
   * @property {String|undefined} next
   */
  async fetchPhotoList (next = null) {
    const query = [ this.id, (next || null), null, null, 0 ];
    const results =
      await this._gphotos._sendDataQuery(71837398, query)
        .catch((_err) => {
          this._logger.error(`Failed to fetch photos. ${_err.message}`);
          return Promise.reject(_err);
        });

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

  /**
   * @return {Promise<boolean,Error>}
   */
  async remove () {
    const query = [[ this.id ], []];

    await this._gphotos._sendMutateQuery(85534195, query)
      .catch((_err) => {
        this._logger.error(`Failed to remove album. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }
}

export default GPhotosAlbum;
