/// <reference path="type_declarations/index.d.ts" />
import {VNode, VChild, h, create, diff, patch} from 'virtual-dom';

import JSZip = require('jszip');
import docx = require('./formats/docx');
import {base64} from 'coders';
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
  })
  .state('word.file', {
    url: '/files/:name',
    templateUrl: 'templates/word_file.html',
    controller: 'wordFileCtrl',
  })
  .state('xdoc', {
    url: '/xdoc',
    templateUrl: 'templates/xdoc.html',
    controller: 'xdocCtrl',
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
    var base64_string: string = obj.data;
    var bytes = base64.decodeStringToBytes(base64_string);
    var arraybuffer = new Uint8Array(bytes).buffer;
    return new LocalFile(obj.name, obj.size, obj.type, obj.lastModifiedDate, arraybuffer);
  }
  toJSON() {
    var bytes = new Uint8Array(this.arraybuffer);
    return {
      __type__: 'LocalFile',
      name: this.name,
      size: this.size,
      type: this.type,
      lastModifiedDate: this.lastModifiedDate,
      data: base64.encodeBytesToString(bytes),
    };
  }
}

// angular-ext.js hack
Types['LocalFile'] = LocalFile;

app.controller('wordCtrl', ($scope, $localStorage) => {
  $scope.$storage = $localStorage;

  $scope.readFile = (file: File) => {
    // sample file = {
    //   lastModifiedDate: Tue Mar 04 2014 15:57:25 GMT-0600 (CST)
    //   name: "asch-stims.xlsx"
    //   size: 34307
    //   type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    //   webkitRelativePath: ""
    // }
    $scope.$storage.file = new LocalFile(file.name, file.size, file.type, file.lastModifiedDate);

    readFileAsArrayBuffer(file, (err, arraybuffer) => {
      $scope.$apply(function() {
        if (err) throw err;
        // return $flash('Error reading file ' + file.name);
        $scope.$storage.file.arraybuffer = arraybuffer;
      });
    });
  };

  $scope.$watch('$storage.file.arraybuffer', (arraybuffer: ArrayBuffer) => {
    if (arraybuffer && arraybuffer.byteLength > 0) {
      $scope.zip = new JSZip(arraybuffer);
    }
  });
});

app.controller('wordFileCtrl', ($scope, $state, $localStorage) => {
  $scope.$storage = $localStorage;

  var zip = new JSZip($scope.$storage.file.arraybuffer);
  var file = $scope.file = zip.file($state.params.name);
  var text = $scope.text = file.asText();
});

app.controller('xdocCtrl', ($scope, $localStorage) => {
  $scope.$storage = $localStorage;

  $scope.$watch('$storage.file.arraybuffer', (arraybuffer: ArrayBuffer) => {
    if (arraybuffer && arraybuffer.byteLength > 0) {
      $scope.document = docx.parseXDocument(arraybuffer);
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
      var element: Element;
      var vtree: VNode;

      function update(xDocument: xdom.XDocument) {
        log('update() called in xdomDocument directive', xDocument);
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

function mapNodes<T>(nodes: NodeList, func: (node: Node) => T) {
  var result: T[] = [];
  for (var i = 0, node: Node; (node = nodes[i]); i++) {
    result.push(func(node));
  }
  return result;
}

function mapAttributes<T>(attributes: NamedNodeMap, func: (attr: Attr) => T) {
  var result: T[] = [];
  for (var i = 0, attr: Attr; (attr = attributes[i]); i++) {
    result.push(func(attr));
  }
  return result;
}

function renderAttributes(attributes: NamedNodeMap) {
  return mapAttributes(attributes, attr => h('span.attribute', [h('span.name', attr.name), '=', h('span.value', attr.value)]));
}

function renderXmlNodes(nodes: NodeList) {
  return mapNodes(nodes, (node: Node) => renderXmlNode(node));
}

function renderXmlNode(node: Node) {
  if (node.nodeType == Node.TEXT_NODE) {
    var text = <Text>node;
    return h('div.text', text.data);
  }
  else if (node.nodeType == Node.ELEMENT_NODE) {
    var element = <Element>node;
    var tagName = element.tagName;
    var startTagChildren: VChild[] = ['<', tagName];
    startTagChildren = startTagChildren.concat(renderAttributes(element.attributes)).concat('>');
    var startTag = h('span.start', startTagChildren);
    var endTag = h('span.end', {}, ['</', tagName, '>']);
    return h('div.element', [startTag, renderXmlNodes(node.childNodes), endTag]);
  }
  else {
    return h('span', `(Ignoring node type = ${node.nodeType})`);
  }
}

app.directive('xmlTree', () => {
  return {
    restrict: 'E',
    scope: {
      xml: '=',
    },
    link: (scope, el) => {
      var element: Element;
      var vtree: VNode;

      function update(new_vtree: VNode) {
        log('update() called in xmlTree directive');
        if (vtree === undefined) {
          vtree = new_vtree;
          element = create(vtree)
          el[0].appendChild(element);
        }
        else {
          var patches = diff(vtree, new_vtree)
          element = patch(element, patches)
          vtree = new_vtree;
        }
      }

      scope.$watch('xml', (xml: string) => {
        log('wordFileCtrl $watch xml');
        if (xml) {
          var document = new DOMParser().parseFromString(xml, 'application/xml');
          var new_vtree = h('div', renderXmlNodes(document.childNodes));
          update(new_vtree);
        }
      });
    }
  };
});
