# upload-gphotos

[![NPM](https://nodei.co/npm/upload-gphotos.png?compact=true)](https://nodei.co/npm/upload-gphotos/)

[![NPM VERSION](https://img.shields.io/npm/v/upload-gphotos.svg?style=flat-square)](https://www.npmjs.com/package/upload-gphotos)
[![GITHUB RELEASE](https://img.shields.io/github/release/3846masa/upload-gphotos.svg?style=flat-square)](https://github.com/3846masa/upload-gphotos/releases)
[![LICENSE](https://img.shields.io/github/license/mashape/apistatus.svg?style=flat-square)](./LICENSE)

Google Photos にファイルをアップロード．

Upload photo to Google Photos (Unofficial).

## Preparation

**USE AT YOUR OWN RISK**

1. Turn on "Allowing less secure apps to access your account"
  - https://support.google.com/accounts/answer/6010255
2. Setup Google+ account

## Installation

### npm (Recommended)
```
$ npm install -g upload-gphotos
```

### Executable file
Download your platform's binary via [GitHub Releases].

[GitHub Releases]: https://github.com/3846masa/upload-gphotos/releases

## Usage
```
$ upload-gphotos -u USERNAME -p PASSWORD file [...]
```

Example

```bash
$ upload-gphotos -u example@gmail.com -p StR0ngP@ssw0rd photo-1.jpg video-1.mp4
```

Output will look like this

```text
Success to login!
UserID is 109088602193233xxxxxx.
atParam is AKP94S0mEotS20MjQfEKVOwW1aZPxxxxxx:1492151xxxxxx.

Uploading [=======================================================================================] 100% 0.0s

Uploaded successfully!
[
  {
    "id": "AF1QipNbxR9mSqgG2Z23bxxxxxxxxxxxxxx_yzS8",
    "uploadedAt": "2017-04-14T06:26:48.080Z",
    "createdAt": "2017-04-14T06:26:47.892Z",
    "title": "2017-04-14_11-37-28.mp4",
    "description": "",
    "rawUrl": "https://lh3.googleusercontent.com/-7GrpTUxxxxxx/WPBrxxxxxx/AAAAAAxxxxx/o92LsGKWej87x0baba4kZeksc43Oxxxxxxxxx/photo-1.jpg",
    "type": "photo"
  },
  {
    "id": "AF1QipNbxR9mSqgG2Z23bxxxxxxxxxxxxxx_yzS8",
    "uploadedAt": "2017-04-14T06:26:48.080Z",
    "createdAt": "2017-04-14T06:26:47.892Z",
    "title": "2017-04-14_11-37-28.mp4",
    "description": "",
    "rawUrl": "https://lh3.googleusercontent.com/-7GrpTUxxxxxx/WPBrxxxxxx/AAAAAAxxxxx/o92LsGKWej87x0baba4kZeksc43Oxxxxxxxxx/video-1.mp4",
    "type": "video"
  }
]
```

## Library
This is also node.js library.

```js
(async () => {
const gphotos = new GPhotos({ username: '', password: '' });
await gphotos.login();

const photo = await gphotos.upload(filePath);
const album = await gphotos.searchOrCreateAlbum('TestAlbum');
await album.addPhoto(photo);
})();
```

See [Documentation].

[Documentation]: https://doc.esdoc.org/github.com/3846masa/upload-gphotos
