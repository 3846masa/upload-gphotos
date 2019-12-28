#!/usr/bin/env node
import fs from 'fs';
import libpath from 'path';
import inquirer from 'inquirer';
import Configstore from 'configstore';
import { CookieJar } from 'tough-cookie';
import pRetry from 'p-retry';
import ora from 'ora';

import { GPhotos, GPhotosAlbum } from '../';
import { LIBRARY_NAME } from '../constants';
import { encodeCookie, decodeCookie } from './cookies';
import { yargs } from './yargs';

if (yargs.argv.version) {
  yargs.showHelp();
  process.exit(0);
}

(async () => {
  const files = yargs.argv._;

  try {
    await Promise.all(files.map((path) => fs.promises.access(path)));
  } catch (_err) {
    yargs.showHelp();
    process.abort();
  }

  const { username = yargs.argv.username!, password = yargs.argv.password! } = await inquirer.prompt([
    {
      type: 'input',
      name: 'username',
      message: 'Username?',
      when: !yargs.argv.username,
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password?',
      when: !yargs.argv.password,
    },
  ]);

  // Restore cookies
  const conf = new Configstore(LIBRARY_NAME, {});
  const jar =
    conf.has('jar') && conf.has('iv') && username === conf.get('username')
      ? decodeCookie({ password, encoded: conf.get('jar'), iv: Buffer.from(conf.get('iv'), 'base64') })
      : new CookieJar();

  // Login
  const gphotos = new GPhotos();
  gphotos.setCookieJar(jar);

  try {
    await gphotos.signin({
      username,
      password,
    });
  } catch (err) {
    console.error(`Failed to login.`);
    throw err;
  }

  // Store cookies
  const encoded = encodeCookie({ jar, password });
  conf.set('username', username);
  conf.set('jar', encoded.encoded);
  conf.set('iv', encoded.iv.toString('base64'));

  const albumList: GPhotosAlbum[] = await Promise.all(
    yargs.argv.album.map(async (title) => {
      return (await gphotos.searchAlbum({ title })) || (await gphotos.createAlbum({ title }));
    }),
  );

  for (const filepath of files) {
    const spinner = ora();
    const photo = await pRetry(
      async () => {
        const stream = fs.createReadStream(filepath);
        const filesize = (await fs.promises.stat(filepath)).size;
        const filename = libpath.basename(filepath);

        if (!yargs.argv.quiet) {
          let passedSize = 0;
          stream.on('open', () => spinner.start(`Uploading "${filename}"`));
          stream.on('data', (chunk) => {
            passedSize += chunk.length;
            spinner.text = `Uploading "${filename}" ${Math.floor((passedSize / filesize) * 100)}%`;
          });
          stream.on('end', () => spinner.succeed(`Uploaded "${filename}"`));
        }

        return gphotos.upload({
          stream,
          size: filesize,
          filename,
        });
      },
      {
        retries: yargs.argv.retry,
      },
    );

    for (const album of albumList) {
      await album.append(photo);
    }

    if (yargs.argv['output-json']) {
      await fs.promises.writeFile(
        filepath.replace(/\.[^.]*?$/, '.upload-info.json'),
        JSON.stringify(await photo.getInfo(), null, 2),
        'utf8',
      );
    }
  }
})().catch(function(err) {
  console.error(err.stack);
  process.abort();
});
