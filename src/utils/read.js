import read from 'read';

export default (options) => new Promise((resolve, reject) => {
  options = Object.assign({ output: process.stderr }, options);
  read(options, function (err, result) {
    if (err) {
      reject(err);
    } else {
      resolve(result);
    }
  });
});
