import jsdom from 'jsdom';

jsdom.envAsync = function (html) {
  return new Promise((resolve, reject) => {
    jsdom.env({
      html: html,
      features: {
        FetchExternalResources: false,
        ProcessExternalResources: ['script']
      },
      done: (err, window) => {
        if (err) reject(err);
        resolve(window);
      }
    });
  });
};

export default jsdom;
