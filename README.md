# upload-gphotos

[![NPM](https://nodei.co/npm/upload-gphotos.png?compact=true)](https://nodei.co/npm/upload-gphotos/)

[![NPM VERSION](https://img.shields.io/npm/v/upload-gphotos.svg?style=flat-square)](https://www.npmjs.com/package/upload-gphotos)
[![GITHUB RELEASE](https://img.shields.io/github/release/3846masa/upload-gphotos.svg?style=flat-square)](https://github.com/3846masa/upload-gphotos/releases)
[![LICENSE](https://img.shields.io/github/license/mashape/apistatus.svg?style=flat-square)](./LICENSE)
[![Greenkeeper badge](https://img.shields.io/badge/Greenkeeper-enabled-brightgreen.svg?style=flat-square)](https://greenkeeper.io/)

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

[Documentation]: https://3846masa.github.io/upload-gphotos
