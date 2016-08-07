import JSON from './utils/json-async';

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
    this._uploadInfo = uploadInfo;
    this.type = type;
    this._gphotos = _parent;
    this._request = this._gphotos._request;
    this._logger = this._gphotos._logger;
  }

  async removeFromAlbum () {
    const reqQuery = [
      'af.maf',
      [[
        'af.add',
        85381832,
        [{
          '85381832': [ [ this.id ], [] ]
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
      this._logger.error(`Failed to remove photo. ${queryRes.statusMessage}`);
      return Promise.reject(new Error(`Failed to remove photo. ${queryRes.statusMessage}`));
    }
    return true;
  }
}

export default GPhotosPhoto;
