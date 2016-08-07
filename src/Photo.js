class GPhotosPhoto {
  /**
   * @ignore
   */
  constructor ({
    id, uploadedAt, createdAt, type = 'photo',
    title, length, width, height, rawUrl, uploadInfo, _parent
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

    await this._gphotos._sendMutateQuery(85381832, query)
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

    await this._gphotos._sendMutateQuery(73931313, query)
      .catch((_err) => {
        this._logger.error(`Failed to remove photo. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }
}

export default GPhotosPhoto;
