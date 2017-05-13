class GPhotosPhoto {
  /**
   * @ignore
   */
  constructor ({
    id, uploadedAt, createdAt, type = 'photo',
    title, description, length, width, height, fileSize, rawUrl, uploadInfo, _gphotos
  }) {
    /** @type {String} */
    this.id = id;
    /** @type {?Date} */
    this.uploadedAt = new Date(uploadedAt);
    /** @type {?Date} */
    this.createdAt = new Date(createdAt);
    /** @type {?String} */
    this.title = title;
    /** @type {?String} */
    this.description = description;
    /** @type {?number} */
    this.length = length;
    /** @type {?number} */
    this.width = width;
    /** @type {?number} */
    this.height = height;
    /** @type {?number} */
    this.fileSize = fileSize;
    /** @type {?String} */
    this.rawUrl = rawUrl;
    /** @type {String} */
    this.type = type;

    Object.defineProperties(this, {
      '_gphotos': {
        value: _gphotos
      },
      '_logger': {
        value: _gphotos._logger
      },
      '_uploadInfo': {
        value: uploadInfo,
        writable: true
      }
    });
  }

  /**
   * @param  {Object} data
   * @return {Object}
   */
  static parseInfo (data) {
    const lastIdx = data.length - 1;
    const type =
      (!data[lastIdx] || typeof data[lastIdx] !== 'object') ? 'photo' :
      ('76647426' in data[lastIdx]) ? 'video' :
      ('139842850' in data[lastIdx]) ? 'animation_gif' : 'photo';

    return {
      id: data[0],
      createdAt: new Date(data[2]),
      uploadedAt: new Date(data[5]),
      type: type,
      length: (type === 'video') ? data[lastIdx]['76647426'][0] : null,
      width: (type === 'video') ? data[lastIdx]['76647426'][2] : data[1][1],
      height: (type === 'video') ? data[lastIdx]['76647426'][3] : data[1][2],
      rawUrl: data[1][0],
    };
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
   * @return {Promise<GPhotosPhoto,Error>}
   */
  async fetchInfo () {
    const queries = {
      '73756775': [this.id, 1],
      '74881883': [this.id, null, null, true],
    };

    const results =
      await Promise.all(
        Object.keys(queries)
          .map((key) => this._gphotos._sendDataQuery(key, queries[key]))
      )
      .catch((_err) => {
        this._logger.error(`Failed to fetch info. ${_err.message}`);
        return Promise.reject(_err);
      });

    this.description = results[0][0][1];
    this.title = results[0][0][2];
    this.fileSize = results[0][0][5];

    const info = GPhotosPhoto.parseInfo(results[1][0]);
    Object.assign(this, info);

    return this;
  }

  /**
   * @param {Date|number|string} createdDate
   * @param {?number} [timezoneSec=null] seconds of timezone
   * @return {Promise<boolean,Error>}
   */
  async modifyCreatedDate (createdDate, timezoneSec = null) {
    const diffTime =
      Math.round((new Date(createdDate).getTime() - this.createdAt.getTime()) / 1000);
    const query = [[[this.id, null, timezoneSec, diffTime]]];

    await this._gphotos._sendMutateQuery(115094896, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to modify created date. ${_err.message}`);
        return Promise.reject(_err);
      });

    await this.fetchInfo();
    return true;
  }

  /**
   * @param {string} description
   * @return {Promise<boolean,Error>}
   */
  async modifyDescription (description) {
    const query = [null, description, this.id];

    await this._gphotos._sendMutateQuery(74747338, query, true)
      .catch((_err) => {
        this._logger.error(`Failed to modify description. ${_err.message}`);
        return Promise.reject(_err);
      });

    await this.fetchInfo();
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
