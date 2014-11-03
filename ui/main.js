/*jslint browser: true */

function t_(url) {
  //return url + '?t_=' + new Date().getTime();
  return url + '?t_=' + (Math.random() * 1000 | 0);
}

require.config({
  shim: {
    'static/lib/angular': {
      exports: 'angular'
    },
    // angular plugins:
    'static/angular-ext': ['static/lib/angular'],
    'static/lib/angular-ui-router.min': ['static/lib/angular'],
    'static/lib/ngStorage.min': ['static/lib/angular'],
    'static/lib/angular-plugins': ['static/lib/angular'],
  },
  paths: {
    'jszip': 'static/lib/jszip.min',
    'ui/ng/app': t_('ui/ng/app.js'),
  },
  //urlArgs: 't_=' + new Date().getTime(),
});

require([
  'static/lib/lodash.min',
  'static/lib/angular',
  'static/angular-ext',
  'ui/ng/app',
  //'jszip',
  //'static/lib/jszip.min',
  //'formats/docx',
  //'base64',
  //'local',
  //'blocks',
], function(_, angular, app) {
  angular.bootstrap(document, ['app']);
});
