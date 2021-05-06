const path = require('path');

module.exports = {
  mode: 'production',
  target: 'web',
  output: {
    path: path.join(__dirname, 'dist'),
    filename: '[name].min.js',
    library: '[name]',
    libraryTarget: 'umd'
  },
  node: false,
  resolve: {
    fallback: {
      util: false,
      crypto: false
    }
  }
};
