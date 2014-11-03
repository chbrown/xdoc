define([
  'require',
  'exports',
  'static/lib/angular',
  'base64',
  'formats/docx',
  // angular plugins:
  'static/lib/angular-ui-router.min',
  'static/lib/ngStorage.min',
  'static/lib/angular-plugins',
], function(require, exports, angular, base64, docx) {

  var app = angular.module('app', [
    'ngStorage',
    'ui.router',
    'misc-js/angular-plugins',
  ]);

  app.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/word');

    $stateProvider
      .state('word', {
        url: '/word',
        templateUrl: t_('templates/word.html'),
      })
      .state('validate', {
        url: '/validate',
        templateUrl: t_('templates/validate.html'),
      });

    //$locationProvider.html5Mode(true);
  });

  var readFileAsDataURL = function(file, callback) {
    var reader = new FileReader();
    reader.onerror = function(err) {
      callback(err);
    };
    reader.onload = function(ev) {
      callback(null, reader.result);
    };
    // reader.readAsArrayBuffer(file);
    reader.readAsDataURL(file);
  };

  var readFileAsArrayBuffer = function(file, callback) {
    var reader = new FileReader();
    reader.onerror = function(err) {
      callback(err);
    };
    reader.onload = function(ev) {
      callback(null, reader.result);
    };
    reader.readAsArrayBuffer(file);
  };

  var LocalFile = function(name, size, type, lastModifiedDate) {
    this.name = name;
    this.size = size;
    this.type = type;
    this.lastModifiedDate = lastModifiedDate;
    this.arraybuffer = null; // new ArrayBuffer();
  };
  LocalFile.fromJSON = function(obj) {
    var local_file = new LocalFile(obj.name, obj.size, obj.type, obj.lastModifiedDate);
    local_file.arraybuffer = base64.decodeArrayBuffer(obj.data);
    return local_file;
  };
  LocalFile.prototype.toJSON = function() {
    return {
      __type__: 'LocalFile',
      name: this.name,
      size: this.size,
      type: this.type,
      lastModifiedDate: this.lastModifiedDate,
      data: base64.encodeArrayBuffer(this.arraybuffer),
    };
  };

  // angular-ext.js hack
  Types.LocalFile = LocalFile;

  app.controller('wordCtrl', function($scope, $http, $flash, $localStorage) {
    $scope.$storage = $localStorage;

    var upload_el = document.querySelector('input[type="file"]');
    angular.element(upload_el).on('change', function(ev) {
      $scope.$apply(function() {
        var input = ev.target;
        var file = input.files[0];
        // sample file = {
        //   lastModifiedDate: Tue Mar 04 2014 15:57:25 GMT-0600 (CST)
        //   name: "asch-stims.xlsx"
        //   size: 34307
        //   type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        //   webkitRelativePath: ""
        // }
        $scope.$storage.file = new LocalFile(file.name, file.size, file.type, file.lastModifiedDate);

        readFileAsArrayBuffer(file, function(err, arraybuffer) {
          if (err) {
            return $flash('Error reading file ' + file.name);
          }

          $scope.$apply(function() {
            $scope.$storage.file.arraybuffer = arraybuffer;
          });
        });
      });
    });

    $scope.$watch('$storage.file.arraybuffer', function(new_arraybuffer, old_arraybuffer) {
      if (new_arraybuffer && new_arraybuffer.byteLength > 0) {
        $scope.document = docx.parseXDocument(new_arraybuffer);

        // <div style="white-space: pre-wrap">
        //   <span ng-repeat="span in document.spans track by $index" ng-bind-html="span.toHTML() | trust"></span>
        // </div>
        $scope.element = $scope.document.toDOM();

        var document_placeholder = document.getElementById('document_placeholder');
        // get rid of the current children, if there are any
        while (document_placeholder.firstChild) {
          document_placeholder.removeChild(document_placeholder.firstChild);
        }

        document_placeholder.appendChild($scope.element);
      }
    });

  });

});
