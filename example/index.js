const path = require('path');
const GPhotos = require('../').default;

const gphotos = new GPhotos({
  username: process.env.GPHOTOS_USERNAME,
  password: process.env.GPHOTOS_PASSWORD,
});

(async () => {
  await gphotos.login();
  const album = await gphotos.searchOrCreateAlbum('TestAlbum');
  const photo = await gphotos.upload(path.join(__dirname, './example.jpg'));
  await album.addPhoto(photo);
  console.log(photo);
})().catch(console.error);
