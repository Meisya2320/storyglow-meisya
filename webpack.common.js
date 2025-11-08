const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    app: path.resolve(__dirname, 'src/scripts/index.js'),
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // ✅ Clean dist folder sebelum build
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]', // ✅ Simpan images di folder images/
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: path.resolve(__dirname, 'src/index.html'),
      favicon: path.resolve(__dirname, 'src/public/favicon.png'),
    }),
    new CopyWebpackPlugin({
      patterns: [
        // ✅ Copy public folder (images, favicon, dll)
        {
          from: path.resolve(__dirname, 'src/public/'),
          to: path.resolve(__dirname, 'dist/'),
          noErrorOnMissing: true,
          globOptions: {
            ignore: ['**/favicon.png'], // Skip favicon (sudah di-handle HtmlWebpackPlugin)
          },
        },
        // ✅ Copy manifest.json dari root
        {
          from: path.resolve(__dirname, 'manifest.json'),
          to: path.resolve(__dirname, 'dist/manifest.json'),
          noErrorOnMissing: true,
        },
        // ✅ Copy sw.js dari root
        {
          from: path.resolve(__dirname, 'sw.js'),
          to: path.resolve(__dirname, 'dist/sw.js'),
          noErrorOnMissing: true,
        },
        // ✅ Copy offline.html dari root
        {
          from: path.resolve(__dirname, 'offline.html'),
          to: path.resolve(__dirname, 'dist/offline.html'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],
};