var nexe = require('nexe');

nexe.compile(
  {
    input: './main.js',
    output: './upload-gphotos',
    nodeVersion: 'latest',
    nodeTempDir: './tmp/nexe',
    flags: true,
    resourceFiles: ["./sendRequest.json"],
    python: 'python',
    framework: 'io.js'
  },
  function (err) {
    if (err) {
      console.log(err);
    }
  }
);
