class GPhotosPhoto {
  constructor ({
    id, uploadedAt, createdAt, type = 'photo',
    title, length, width, height, rawUrl, uploadInfo, _parent
  }) {
    this.id = id;
    this.uploadedAt = new Date(uploadedAt);
    this.createdAt = new Date(createdAt);
    this.title = title;
    this.length = length;
    this.width = width;
    this.height = height;
    this.rawUrl = rawUrl;
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

  async removeFromAlbum () {
    const query = [ [ this.id ], [] ];

    await this._gphotos._sendMutateQuery(85381832, query)
      .catch((_err) => {
        this._logger.error(`Failed to remove photo. ${_err.message}`);
        return Promise.reject(_err);
      });

    return true;
  }
}

export default GPhotosPhoto;
