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
}

export default GPhotosPhoto;
