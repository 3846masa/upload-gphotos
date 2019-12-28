import fs from 'fs';
import libpath from 'path';
import _yargs from 'yargs';

const packageInfo = JSON.parse(fs.readFileSync(libpath.resolve(__dirname, '../../package.json'), 'utf8'));

const yargs = _yargs
  .demand(1)
  .usage(
    `
Upload-GPhotos ${packageInfo.version}
Usage: upload-gphotos file [...] [--no-output-json] [--quiet] [-r retry] [-u username] [-p password] [-a albumname]
  `.trim(),
  )
  .help('help')
  .options({
    retry: {
      alias: 'r',
      type: 'number',
      default: 3,
      desc: 'The number of times to retry when failed uploads.',
    },
    username: {
      alias: 'username',
      type: 'string',
      desc: 'Google account username.',
    },
    password: {
      alias: 'p',
      type: 'string',
      desc: 'Google account password.',
    },
    album: {
      alias: 'a',
      type: 'array',
      default: [] as string[],
      desc: 'An albums to put uploaded files.',
    },
    quiet: {
      type: 'boolean',
      default: false,
      desc: 'Prevent to show progress.',
    },
    'output-json': {
      type: 'boolean',
      default: true,
      desc: 'Output information of uploading as JSON.',
    },
    help: {
      alias: 'h',
      type: 'boolean',
      desc: 'Show help.',
    },
    version: {
      alias: 'v',
      type: 'boolean',
      desc: 'Show version number.',
    },
  });

export { yargs };
