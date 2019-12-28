const fs = require('fs');
const libpath = require('path');
const { GPhotos } = require('../');

const gphotos = new GPhotos();
const filepath = libpath.join(__dirname, './example.jpg');

(async () => {
  await gphotos.signin({
    username: process.env.GPHOTOS_USERNAME,
    password: process.env.GPHOTOS_PASSWORD,
  });

  const album =
    (await gphotos.searchAlbum({ title: 'TestAlbum' })) || (await gphotos.createAlbum({ title: 'TestAlbum' }));

  const photo = await gphotos.upload({
    stream: fs.createReadStream(filepath),
    size: (await fs.promises.stat(filepath)).size,
    filename: libpath.basename(filepath),
  });

  await album.append(photo);

  console.log(photo);
})().catch(console.error);
