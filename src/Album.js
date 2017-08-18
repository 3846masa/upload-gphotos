import Photo from './Photo';

class GPhotosAlbum {
  /**
   * @ignore
   */
  constructor ({
    id, title,key, period = { from: new Date(0), to: new Date(0) },
    items_count = 0, _gphotos
  }) {
    /** @type {String} */
    this.id = id;
    /** @type {String} */
    this.title = title;
	/** @type {String} */
    this.key = key;
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
        value: _gphotos
      },
      '_logger': {
        value: _gphotos._logger
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
        .catch(() => {
          // Fallback: If album is shared, use 99484733.
          const query = [
            [ this.id ],
            [ 2, null, [[ photos.map((p) => p.id) ]], null, null, [], [] ],this.key,[null,null,null,null,[null,[]]]
          ];
          return this._gphotos._sendMutateQuery(99484733, query);
        })
        .catch((_err) => {
          this._logger.error(`Failed to add photo in album. ${_err.message}`);
          return Promise.reject(_err);
        });
		
    const filterid = results[1] || [];
	const insertedPhotoIds = (!filterid || typeof filterid[0] !== 'object') ? filterid : (filterid[0].length>10) ? filterid : [filterid[0][0]];
	
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

    const photoList = results[1].map((info) => {
      const data = Object.assign(Photo.parseInfo(info), { _gphotos: this._gphotos });
      return new Photo(data);
    });

    return { list: photoList, next: results[2] || null };
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
   * @return {Promise<boolean,Error>}
   */
  async remove () {
    const query = [[ this.id ], []];

    await this._gphotos._sendMutateQuery(85534195, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to remove album. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }
}

export default GPhotosAlbum;
