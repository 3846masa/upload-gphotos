# upload-gphotos

[![NPM](https://nodei.co/npm/upload-gphotos.png?compact=true)](https://nodei.co/npm/upload-gphotos/)

[![NPM VERSION](https://flat.badgen.net/npm/v/upload-gphotos?icon=npm)](https://www.npmjs.com/package/upload-gphotos)
[![GITHUB RELEASE](https://flat.badgen.net/github/release/3846masa/upload-gphotos)](https://github.com/3846masa/upload-gphotos/releases)
[![LICENSE](https://flat.badgen.net/github/license/3846masa/upload-gphotos)](./LICENSE)

Google Photos にファイルをアップロード．

Upload photos to Google Photos (Unofficial).

**CAUTION** | This library use an internal Google Photos API. **USE AT YOUR OWN RISK**

## Requirement

- Required: Chrome or Chromium
  - If you installed Chrome to custom path, set `PUPPETEER_EXECUTABLE_PATH`

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

### Executable file (Recommended)

Download your platform's binary via [GitHub Releases].

[github releases]: https://github.com/3846masa/upload-gphotos/releases

### npm

```
$ npm install -g upload-gphotos
```

## Usage

```
$ upload-gphotos file [...] [--no-output-json] [--quiet] [-r retry] [-u username] [-p password] [-a albumname]
```

## Library

This is also Node.js library.

```js
const fs = require('fs');
const libpath = require('path');
const { GPhotos } = require('upload-gphotos');

const gphotos = new GPhotos();
const filepath = libpath.join(__dirname, './example.jpg');

(async () => {
  await gphotos.signin({
    username,
    password,
  });

  const album = await gphotos.searchAlbum({ title: 'TestAlbum' });

  const photo = await gphotos.upload({
    stream: fs.createReadStream(filepath),
    size: (await fs.promises.stat(filepath)).size,
    filename: libpath.basename(filepath),
  });

  await album.append(photo);

  console.log(photo);
})().catch(console.error);
```

## FAQ

- **Q.** Why not using Google Photos API?
  - **A.** It cannot upload with "High quality" option. See [issues#304(comments)].
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
[issues#304(comments)]: https://github.com/3846masa/upload-gphotos/issues/304#issuecomment-433676584
