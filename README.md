# upload-gphotos

[![NPM](https://nodei.co/npm/upload-gphotos.png?compact=true)](https://nodei.co/npm/upload-gphotos/)

[![NPM VERSION](https://img.shields.io/npm/v/upload-gphotos.svg?style=flat-square)](https://www.npmjs.com/package/upload-gphotos)
[![GITHUB RELEASE](https://img.shields.io/github/release/3846masa/upload-gphotos.svg?style=flat-square)](https://github.com/3846masa/upload-gphotos/releases)
[![LICENSE](https://img.shields.io/github/license/mashape/apistatus.svg?style=flat-square)](./LICENSE)
[![Greenkeeper badge](https://img.shields.io/badge/Greenkeeper-enabled-brightgreen.svg?style=flat-square)](https://greenkeeper.io/)

Google Photos にファイルをアップロード．

Upload photos to Google Photos (Unofficial).

## Preparation

**USE AT YOUR OWN RISK**

1. Turn on "Allowing less secure apps to access your account"
    - https://support.google.com/accounts/answer/6010255
2. (Optional) Login Google via browser if you haven't login from current IP address.
    - I recommend to login via VNC using [fcwu/docker-ubuntu-vnc-desktop].
    - Other way: using [apenwarr/sshuttle]
        - FYI: [issues#113(comments)]

[fcwu/docker-ubuntu-vnc-desktop]: https://github.com/fcwu/docker-ubuntu-vnc-desktop
[apenwarr/sshuttle]: https://github.com/apenwarr/sshuttle
[issues#113(comments)]: https://github.com/3846masa/upload-gphotos/issues/113#issuecomment-277141489

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
$ upload-gphotos [<file>...] [--quiet] [-r <retry>] [-u <username>] [-p <password>] [-a <albumname>]
```

## Library
This is also Node.js library.

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

[Documentation]: https://3846masa.github.io/upload-gphotos/modules/_index_.html

## FAQ

- **Q.** Is it support to login with SMS / 2FA / Application password?
    - **A.** No. I have no plan to support. See [issues#196].
- **Q.** I can't login, Why?
    - **A.** Please try to login via browser, first.
    - Google will ban to login from unknown IP.
- **Q.** When uploading large / many files, Uploading was failed.
    - **A.** It maybe limitations of Google Photos.
    - Limitations is below. (FYI: [issues#246], [issues#256(comments)])
        - 75 MB or 100 megapixels / 1 photo
        - 10 GB / 1 video
        - Total bandwidth maybe 10 GB / 1 day

[issues#196]: https://github.com/3846masa/upload-gphotos/issues/196
[issues#246]: https://github.com/3846masa/upload-gphotos/issues/246
[issues#256(comments)]: https://github.com/3846masa/upload-gphotos/issues/256#issuecomment-356458407
