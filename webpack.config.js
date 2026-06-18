require('dotenv').config({silent: true});
const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');
const path = require('path');
const pkg = require(__dirname + '/package.json');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const siteJs = ['./scripts/site.js']

const config = {
  mode: IS_PRODUCTION ? 'production' : 'development',
  devtool: IS_PRODUCTION ? false : 'source-map',
  entry: {
    'scripts/site-bundle': siteJs
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js'
  },
  plugins: [

    new webpack.DefinePlugin({
      '__DEBUG__': JSON.stringify(!IS_PRODUCTION)
    }),
  ],
  optimization: {
    minimize: IS_PRODUCTION,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          beautify: !IS_PRODUCTION,
          compress: IS_PRODUCTION ? {
            drop_console: true,
            warnings: false
          } : false,
          mangle: IS_PRODUCTION ? {
            reserved: ['_']
          } : false
        }
      })
    ]
  } 
}

module.exports = config;
