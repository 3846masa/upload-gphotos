#!/usr/bin/env node
import fs from 'fs-promise';
import log4js from 'log4js';
import argParser from 'yargs';
import read from './utils/read';
import GPhotos from './index';
import readline from 'readline';


log4js.configure({
  appenders: [{
    type: 'console',
    layout: {
      type: 'pattern',
      pattern: '%[%p%] %m'
    }
  }]
});
const logger = log4js.getLogger();

//argParser.demand(1);
argParser.usage('Usage: upload-gphotos [-c] [-u username] [-p password] [-a albumname] file [...]');
argParser.options('c', {
  alias: 'challenge',
  desc: 'Answer to the challenge request.'
});
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
argParser.demandOption(['username', 'password']);
argParser.example('./upload-gphotos -c -u xxx -p xxx', 'solve the SMS challenge request');
argParser.example('./upload-gphotos -u xxx -p xxx files', 'upload files to google photo');
argParser.example('./upload-gphotos -u xxx -p xxx -a xxx files', 'upload files to google photo in specific album');
argParser.help('h').alias('h', 'help');

const { c:challenge, u: username, p: password, _: files, a: albumName } = argParser.argv;

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
      logger: logger,
      fromCli:true
    }
  });


  if (challenge){
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const anyChallenge = await gphotos.findSMSChallenge();
    if (anyChallenge){
      rl.question('Enter the 6-digit code the you\'ve received by SMS : \n', async (pin) => {
        await gphotos.sendPinFromSMS(pin);
        rl.close();
        process.exit(0);
      });
    }else{
      process.exit(0);
    }

  }else{
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
  }
})().catch(function (err) {
  logger.error(err.stack);
  process.abort();
});
