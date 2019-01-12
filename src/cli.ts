#!/usr/bin/env node
import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as log4js from 'log4js';
import * as yargs from 'yargs';
import { Arguments } from 'yargs';
import * as inquirer from 'inquirer';
import * as Configstore from 'configstore';
import * as tough from 'tough-cookie';

import GPhotos from './';
import GPhotosPhoto from './Photo';
import GPhotosAlbum from './Album';
import wait from './util/wait';

const packageInfo = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));

interface CLIOptions {
  username: string;
  password: string;
  retry: number;
  album: string[];
  quiet: boolean;
  version: boolean;
}

function decodeCookie(encoded: string, password: string) {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', password);
    const decoded = decipher.update(encoded, 'base64', 'utf8');
    return tough.CookieJar.fromJSON(decoded);
  } catch (_err) {
    return new tough.CookieJar();
  }
}

function encodeCookie(jar: tough.CookieJar, password: string) {
  const cipher = crypto.createCipher('aes-256-cbc', password);
  const decoded = Buffer.concat([cipher.update(JSON.stringify(jar), 'utf8'), cipher.final()]).toString('base64');
  return decoded;
}

log4js.configure({
  appenders: {
    console: {
      type: 'console',
      layout: {
        type: 'pattern',
        pattern: '%[%p%] %m',
      },
    },
  },
  categories: {
    default: {
      appenders: ['console'],
      level: 'all',
    },
  },
});
const logger = log4js.getLogger();

yargs.demand(1);
yargs.usage(
  `
Upload-GPhotos ${packageInfo.version}

Usage: upload-gphotos file [...] [--quiet] [-r retry] [-u username] [-p password] [-a albumname]
  `.trim()
);
yargs.options('r', {
  alias: 'retry',
  type: 'number',
  default: 3,
  desc: 'The number of times to retry when failed uploads.',
});
yargs.options('u', {
  alias: 'username',
  desc: 'Google account username.',
});
yargs.options('p', {
  alias: 'password',
  desc: 'Google account password.',
});
yargs.options('a', {
  alias: 'album',
  array: true,
  desc: 'Album where uploaded files put.',
});
yargs.options('q', {
  alias: 'quiet',
  boolean: true,
  default: false,
  desc: 'Prevent to show progress.',
});
yargs.help('h').alias('h', 'help');
yargs.alias('v', 'version');

const {
  username: _username,
  password: _password,
  quiet,
  retry,
  album: albumNameList,
  version: showVersion,
  _: files,
} = yargs.argv as Arguments<CLIOptions>;

if (showVersion) {
  console.log(packageInfo.version);
  process.exit(0);
}

(async () => {
  try {
    await Promise.all(files.map((path) => fs.access(path)));
  } catch (_) {
    yargs.showHelp();
    process.abort();
  }

  const { username = _username, password = _password } = (await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Username?',
      when: !_username,
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password?',
      when: !_password,
    },
  ])) as { username: string; password: string };

  // Restore cookies
  const conf = new Configstore(packageInfo.name, {});
  const jar =
    conf.has('jar') && username === conf.get('username')
      ? decodeCookie(conf.get('jar'), password)
      : new tough.CookieJar();

  // Login
  const gphotos = new GPhotos({
    username: username,
    password: password,
    options: {
      progress: !quiet,
      jar,
    },
  });
  await gphotos.login().catch((err) => {
    logger.error(`Failed to login. ${err.message}`);
    console.error(jar.serializeSync());
    return Promise.reject(err);
  });

  // Store cookies
  conf.set('username', username);
  conf.set('jar', encodeCookie(jar, password));

  const albumList: GPhotosAlbum[] = [];
  const photos: GPhotosPhoto[] = [];
  for (let path of files) {
    // Try 3 times
    let uploadPromise: Promise<GPhotosPhoto> = Promise.reject(null);
    for (let cnt = 0; cnt < retry; cnt++) {
      uploadPromise = uploadPromise.catch(async (err) => {
        if (err) {
          logger.error(`Failed to upload. Retry after 3 sec. ${err.message}`);
        }
        await wait(3000);
        return gphotos.upload(path);
      });
    }

    const photo = await uploadPromise.catch((err) => {
      logger.error(`Failed to upload. ${err.message}`);
      return Promise.reject(err);
    });

    if (albumNameList && albumList.length !== albumNameList.length) {
      for (let albumName of albumNameList) {
        const album = await gphotos.searchOrCreateAlbum(albumName).catch((err) => {
          logger.error(`Failed to create album. ${err.message}`);
          return Promise.reject(err);
        });
        albumList.push(album);
      }
    }

    for (let album of albumList) {
      await album.addPhoto(photo).catch((err) => {
        logger.error(`Failed to add photo to album. ${err.message}`);
        return Promise.reject(err);
      });
    }
    photos.push(photo);
  }

  console.info(JSON.stringify(photos, null, 2));
})().catch(function(err) {
  logger.error(err.stack);
  process.abort();
});
