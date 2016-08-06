export default {
  parse (...args) {
    return JSON.parse(...args);
  },
  parseAsync (...args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(JSON.parse(...args));
      } catch (_err) {
        reject(_err);
      }
    });
  },
  stringify (...args) {
    return JSON.stringify(...args);
  },
  stringifyAsync (...args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(JSON.stringify(...args));
      } catch (_err) {
        reject(_err);
      }
    });
  }
};
