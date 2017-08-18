#!/usr/bin/env node
import fs from 'fs-promise';
import log4js from 'log4js';
import argParser from 'yargs';
import read from './utils/read';
import GPhotos from './index';

log4js.configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%[%p%] %m'
      },
    },
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'all'
    }
  }
});
const logger = log4js.getLogger();

argParser.demand(1);
argParser.usage(`Usage: upload-gphotos file [...] [-u username] [-p password] [-a albumname]`);
argParser.options('u', {
  alias: 'username',
  desc: 'Google account username.'
});
argParser.options('p', {
  alias: 'password',
  desc: 'Google account password.'
});
argParser.options('a', {
  alias: 'album',
  array: true,
  desc: 'Album where uploaded files put.'
});
argParser.help('h').alias('h', 'help');

const { u: username, p: password, _: files, a: albumNameList } = argParser.argv;

(async () => {
  await Promise.all(files.map((path) => fs.access(path)))
    .catch(() => {
      argParser.showHelp();
      process.exit(255);
    });

  const gphotos = new GPhotos({
    username: username || (await read({ prompt: 'Username: ' })),
    password: password || (await read({ prompt: 'Password: ', silent: true })),
    options: {
      progressbar: true,
      logger: logger
    }
  });
  await gphotos.login();

  const albumList = [];
  const photos = [];
  const photosup = [];
  const shareAlbumList = [];
  
  for (let path of files) {
    const photo = await gphotos.upload(path);
	
    if (albumNameList && albumList.length !== albumNameList.length) {
      for (let albumName of albumNameList) {
        const album = await gphotos.searchOrCreateAlbum(albumName);
        albumList.push(album);
      }
    }

    for (let album of albumList) {
    const  photoalbum = await album.addPhoto(photo);
	 if (album.key == null) {
		 const sharealbum = await gphotos.shareAlbum(album.id);
		 shareAlbumList.push(sharealbum);
	 }
	 photos.push({id:photoalbum});
    }
    
	photosup.push(photo);
	
  }

  console.info('Album');
  console.info(JSON.stringify(albumList, null, 2));
  
  console.info('Share Album Info');
  console.info(JSON.stringify(shareAlbumList, null, 2));
  
  console.info('Photo');
  console.info(JSON.stringify(photosup, null, 2));
  console.info('Photo in Album');
  console.info(JSON.stringify(photos, null, 2));
  
})().catch(function (err) {
  logger.error(err.stack);
  process.abort();
});
