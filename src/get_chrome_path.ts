import fs from 'fs';
import libpath from 'path';
import which from 'which';

import { Maybe } from 'option-t/cjs/Maybe';
import { Nullable, isNotNull } from 'option-t/cjs/Nullable';
import { isNotUndefined } from 'option-t/cjs/Undefinable';
import { unwrapOrFromUndefinable } from 'option-t/cjs/Undefinable/unwrapOr';

const LINUX_CHROME_NAME_LIST = ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium'];

const MACOS_CHROME_PATH_LIST = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
  .map((path) => {
    return ['', process.env.HOME].filter(isNotUndefined).map((programDir) => libpath.join(programDir, path));
  })
  .reduce((a, b) => [...a, ...b], []);

const WIN32_CHROME_PATH_LIST = ['\\Google\\Chrome\\Application\\chrome.exe', '\\Chromium\\Application\\chrome.exe']
  .map((path) => {
    return [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)']]
      .filter(isNotUndefined)
      .map((programDir) => libpath.join(programDir, path));
  })
  .reduce((a, b) => [...a, ...b], []);

function getChromePathList(): Maybe<string>[] {
  if (process.platform === 'linux') {
    return LINUX_CHROME_NAME_LIST.map((cmd) => which.sync(cmd, { nothrow: true }));
  }
  if (process.platform === 'darwin') {
    return MACOS_CHROME_PATH_LIST.filter((path) => fs.existsSync(path));
  }
  if (process.platform === 'win32') {
    return WIN32_CHROME_PATH_LIST.filter((path) => fs.existsSync(path));
  }
  return [];
}

function getChromePath(): Nullable<string> {
  const resultList: Maybe<string>[] = getChromePathList();
  const [result] = resultList.filter(isNotNull);
  return unwrapOrFromUndefinable(result, null);
}

export { getChromePath };
