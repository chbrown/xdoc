const path = require('path');
const webpack = require('webpack');
const packageMetadata = require('./package.json');

const env = process.env.NODE_ENV || 'development';

module.exports = {
  entry: './app',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js',
  },
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(env),
      'window.XDOC_VERSION': JSON.stringify(packageMetadata.version),
    }),
    new webpack.optimize.OccurenceOrderPlugin(),
    ...(env === 'production' ? [
      new webpack.optimize.UglifyJsPlugin(),
    ] : [
      new webpack.NoErrorsPlugin(),
    ]),
  ],
  module: {
    loaders: [
      {
        test: /\.js$/,
        loaders: ['babel-loader'],
        exclude: /node_modules/,
      },
      {
        test: /\.less$/,
        loaders: ['style-loader', 'css-loader', 'less-loader'],
      },
    ],
  },
};
