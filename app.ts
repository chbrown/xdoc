/// <reference path="type_declarations/index.d.ts" />
import {VNode, h, create, diff, patch} from 'virtual-dom';

import docx = require('./formats/docx');
import base64 = require('./base64');
import {log} from './util';
import xdom = require('./xdom');

var Types = {};

function raiseObject(obj) {
  // Even if obj.__type__ is set, we can't assume that Types has such a key
  var classObj = obj;
  if (obj) {
    var Type: any = Types[obj.__type__];
    if (Type) {
      if (Type.fromJSON) {
        classObj = Type.fromJSON(obj);
      }
      else {
        // doesn't cut it and is recommended against on SO,
        // despite Javascript being a Prototype-inheritance language:
        // classObj.__proto__ = Type.prototype;
        classObj = new Type(obj);
        // _.extend(classObj, obj);
      }
    }
  }
  return classObj;
}

function raiseJSON(obj) {
  if (Array.isArray(obj)) {
    return obj.map(raiseJSON);
  }
  else if (obj === Object(obj)) { // that's how _ does it!
    // mutable!
    for (var key in obj) {
      obj[key] = raiseJSON(obj[key]);
    }
    return raiseObject(obj);
  }
  return obj;
};

// maybe look into using the `reviver` argument in JSON.parse(string, reviver)?
// Reference: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse#Example.3A_Using_the_reviver_parameter

// all I need is for ngStorage to use this method instead:
angular.fromJson = json => {
  var obj = angular.isString(json) ? JSON.parse(json) : json;
  return raiseJSON(obj);
}

// ### app ###

var app = angular.module('app', [
  'ui.router',
  'ngStorage',
  'misc-js/angular-plugins',
]);

app.config(($stateProvider, $urlRouterProvider) => {
  $urlRouterProvider.otherwise(($injector, $location) => {
    log('otherwise: coming from "%s"', $location.url());
    return '/word';
  });

  $stateProvider
  .state('word', {
    url: '/word',
    templateUrl: 'templates/word.html',
    controller: 'wordCtrl',
  });
  // .state('validate', {
  //   url: '/validate',
  //   templateUrl: 'templates/validate.html',
  // });
});

function readFileAsDataURL(file: File, callback) {
  var reader = new FileReader();
  reader.onerror = err => callback(err);
  reader.onload = ev => callback(null, reader.result);
  reader.readAsDataURL(file);
}

function readFileAsArrayBuffer(file: File, callback) {
  var reader = new FileReader();
  reader.onerror = err => callback(err);
  reader.onload = ev => callback(null, reader.result);
  reader.readAsArrayBuffer(file);
};

class LocalFile {
  constructor(public name: string,
              public size: number,
              public type: string,
              public lastModifiedDate: string,
              public arraybuffer: ArrayBuffer = null) { }

  static fromJSON(obj: any): LocalFile {
    var arraybuffer = base64.decodeArrayBuffer(obj.data);
    return new LocalFile(obj.name, obj.size, obj.type, obj.lastModifiedDate, arraybuffer);
  }
  toJSON = function() {
    return {
      __type__: 'LocalFile',
      name: this.name,
      size: this.size,
      type: this.type,
      lastModifiedDate: this.lastModifiedDate,
      data: base64.encodeArrayBuffer(this.arraybuffer),
    };
  }
}

// angular-ext.js hack
Types['LocalFile'] = LocalFile;

app.controller('wordCtrl', ($scope, $http, $flash, $localStorage) => {
  $scope.$storage = $localStorage;

  var upload_el = document.querySelector('input[type="file"]');
  angular.element(upload_el).on('change', ev => {
    $scope.$apply(function() {
      var input = <HTMLInputElement>ev.target;
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

  $scope.$watch('$storage.file.arraybuffer', (new_arraybuffer: ArrayBuffer, old_arraybuffer: ArrayBuffer) => {
    if (new_arraybuffer && new_arraybuffer.byteLength > 0) {
      $scope.document = docx.parseXDocument(new_arraybuffer);
      console.log('document', $scope.document);
    }
  });
});


app.directive('xdomDocument', () => {
  return {
    restrict: 'A',
    scope: {
      xdomDocument: '=',
    },
    link: (scope, el) => {
      log('linking', scope);
      var element: Element;
      var vtree: VNode;

      function update(xDocument: xdom.XDocument) {
        log('updating ', xDocument);
        if (vtree === undefined) {
          vtree = xDocument.toVNode();
          element = create(vtree)
          // attach to the dom on the first draw
          el[0].appendChild(element);
        }
        else {
          var new_vtree = xDocument.toVNode();
          var patches = diff(vtree, new_vtree)
          element = patch(element, patches)
          vtree = new_vtree;
        }
      }

      scope.$watch('xdomDocument', (xDocument: xdom.XDocument) => {
        if (xDocument) {
          update(angular.copy(xDocument));
        }
      }, true);
    }
  };
});
