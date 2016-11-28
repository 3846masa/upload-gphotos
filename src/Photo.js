class GPhotosPhoto {
  /**
   * @ignore
   */
  constructor ({
    id, uploadedAt, createdAt, type = 'photo',
    title, length, width, height, filesize, rawUrl, uploadInfo, _parent
  }) {
    /** @type {String} */
    this.id = id;
    /** @type {?Date} */
    this.uploadedAt = new Date(uploadedAt);
    /** @type {?Date} */
    this.createdAt = new Date(createdAt);
    /** @type {?String} */
    this.title = title;
    /** @type {?number} */
    this.length = length;
    /** @type {?number} */
    this.width = width;
    /** @type {?number} */
    this.height = height;
    /** @type {?number} */
    this.filesize = filesize;
    /** @type {?String} */
    this.rawUrl = rawUrl;
    /** @type {String} */
    this.type = type;

    Object.defineProperties(this, {
      '_gphotos': {
        value: _parent
      },
      '_logger': {
        value: _parent._logger
      },
      '_uploadInfo': {
        value: uploadInfo,
        writable: true
      }
    });
  }

  /**
   * @return {Promise<boolean,Error>}
   */
  async removeFromAlbum () {
    const query = [ [ this.id ], [] ];

    await this._gphotos._sendMutateQuery(85381832, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to remove photo. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }

  /**
   * @return {Promise<boolean,Error>}
   */
  async remove () {
    const query = [[], 1, [this.id], 4, null, []];

    await this._gphotos._sendMutateQuery(73931313, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to remove photo. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }

  /**
   * @return {Promise<boolean,Error>}
   */
  async update () {
    const queries = [[this.id, 1],
                     [this.id, null, null, true]];
    const results =
      await Promise.all([
        this._gphotos._sendDataQuery(73756775, queries[0]),
        this._gphotos._sendDataQuery(74881883, queries[1])
      ])
      .catch((_err) => {
        this._logger.error(`Failed to update. ${_err.message}`);
        return Promise.reject(_err);
      });
    this.title = results[0][0][2];
    this.filesize = results[0][0][5];
    this.type = (!results[1][0][12]) ? 'photo' : 'video';
    this.createdAt = new Date(results[1][0][2]);
    this.uploadedAt = new Date(results[1][0][5]);
    this.length = (this.type === 'video') ? results[1][0][12]['76647426'][0] : null;
    this.width = (this.type === 'photo') ? results[1][0][1][1] : results[1][0][12]['76647426'][2];
    this.height = (this.type === 'photo') ? results[1][0][1][2] : results[1][0][12]['76647426'][3];
    this.rawUrl = results[1][0][1][0];
    return true;
  }

  /**
   * @param {Date} createdDate
   * @param {?number} [timezone=null]
   * @return {Promise<boolean,Error>}
   */
  async editCreatedDate (createdDate, timezone=null) {
    const query = [[[this.id, null, timezone, (createdDate.getTime()-this.createdAt.getTime())/1000]]];

    await this._gphotos._sendMutateQuery(115094896, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to edit created date. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }
}

export default GPhotosPhoto;
