const GPhotos = require('.').default;

const gphotos = new GPhotos({
  username: '3846test',
  password: 'masa38460615',
});

(async () => {
  await gphotos.login();
  // const album = await gphotos.searchOrCreateAlbum('TestAlbum');
  const photo = await gphotos.upload('./xxx.png');
  // await album.addPhoto(photo);
  console.log(photo);
  // await photo.remove();
})().catch(console.error);
