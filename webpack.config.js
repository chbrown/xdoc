var path = require('path');
var webpack = require('webpack');

var ngAnnotatePlugin = require('ng-annotate-webpack-plugin');

var production = process.env.NODE_ENV == 'production';

var plugins = production ? [
  new ngAnnotatePlugin({add: true}),
  new webpack.optimize.UglifyJsPlugin(),
  new webpack.optimize.OccurenceOrderPlugin(),
] : [
  new ngAnnotatePlugin({add: true}),
];

module.exports = {
  // devtool: 'source-map',
  entry: ['./app'],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'bundle.js',
  },
  plugins: plugins,
  resolve: {
    extensions: [
      '',
      '.js',
      '.jsx',
    ],
  },
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loaders: ['babel-loader', 'ts-loader'],
        include: __dirname,
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        loaders: ['babel-loader'],
        include: __dirname,
        exclude: /node_modules/,
      },
      {
        test: /\.less$/,
        loaders: ['style-loader', 'css-loader', 'less-loader'],
      },
    ],
  },
};
