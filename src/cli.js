#!/usr/bin/env node
import fs from 'fs-promise';
import path from 'path';
import argParser from 'yargs';
import read from './utils/read';
import log4js from 'log4js';
import GPhotos from './index';

log4js.configure({
  appenders: [{
    type: 'console',
    layout: {
      type: 'pattern',
      pattern: '%[%p%] %m'
    }
  }]
});

argParser.demand(1);
argParser.usage(`Usage: ${path.basename(process.execPath)} [-u username] [-p password] [-a albumname] file [...]`);
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
  desc: 'Album where uploaded files put.'
});
argParser.help('h').alias('h', 'help');

const { u: username, p: password, _: files, a: albumName } = argParser.argv;

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
      logger: log4js.getLogger()
    }
  });
  await gphotos.login();

  const photos = [];
  for (let path of files) {
    photos.push(await gphotos.upload(path));
  }

  if (albumName) {
    const album = await gphotos.searchOrCreateAlbum(albumName);
    await album.addPhotos(photos);
  }

  console.info(JSON.stringify(photos, null, 2));
})().catch(function (err) {
  console.error(err.stack);
  process.abort();
});
