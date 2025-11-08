const { merge } = require('webpack-merge');
const common = require('./webpack.common');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true,
    open: true,
    port: 9000, 
    compress: true,
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
      reconnect: 3,
    },
  },
});