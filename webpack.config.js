var path = require('path');
var webpack = require('webpack');

var production = process.env.NODE_ENV == 'production';

var plugins = production ? [
  new webpack.optimize.UglifyJsPlugin(),
  new webpack.optimize.OccurenceOrderPlugin(),
] : [];

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
      '.jsx'
    ],
  },
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loaders: ['ts-loader'],
        include: __dirname,
        exclude: /node_modules/,
      },
      {
        test: /\.js$/,
        loaders: ['ng-annotate-loader?map=false'],
        include: __dirname,
      },
      {
        test: /\.less$/,
        loaders: ['style-loader', 'css-loader', 'less-loader'],
      },
    ]
  }
};
