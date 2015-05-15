/// <reference path="type_declarations/index.d.ts" />
import {VNode, VChild, h, create, diff, patch} from 'virtual-dom';

import JSZip = require('jszip');
import docx = require('./formats/docx');
import {base64} from 'coders';
import {log, flatten, list} from './util';
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
  })
  // .state('validate', {
  //   url: '/validate',
  //   templateUrl: 'templates/validate.html',
  // });
  .state('latex', {
    url: '/latex',
    templateUrl: 'templates/latex.html',
    controller: 'latexCtrl',
  });
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

  var parser = new docx.Parser($scope.$storage.file.arraybuffer);
  $scope.document = parser.document;
});

app.controller('latexCtrl', ($scope, $localStorage) => {
  $scope.$storage = $localStorage;

  $scope.timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

  var parser = new docx.Parser($scope.$storage.file.arraybuffer);
  var document = parser.document;
  $scope.latex = document.toLaTeX();
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

class XMLRenderer {
  constructor(public blacklist: string[] = []) { }

  protected renderAttributes(attributes: NamedNodeMap): VNode[] {
    return list(attributes).filter(attr => {
      return this.blacklist.indexOf(attr.name) == -1;
    }).map(attr => h('span.attribute',
      [' ', h('span.name', attr.name), '=', h('span.value', `"${attr.value}"`)]));
  }

  protected renderXmlNodes(nodes: NodeList): VNode[] {
    return list(nodes).filter(node => {
      // return false for element nodes which have a blacklisted tag name
      return (node.nodeType != Node.ELEMENT_NODE) || this.blacklist.indexOf((<Element>node).tagName) == -1;
    }).map(node => this.renderXmlNode(node));
  }

  protected renderXmlNode(node: Node) {
    if (node.nodeType == Node.TEXT_NODE) {
      var text = <Text>node;
      return h('div.text', text.data);
    }
    else if (node.nodeType == Node.ELEMENT_NODE) {
      var element = <Element>node;
      var tagName = element.tagName;
      var startTagChildren: VChild[][] = [['<', tagName], this.renderAttributes(element.attributes), ['>']];
      var startTag = h('span.start', flatten(startTagChildren));
      var endTag = h('span.end', {}, ['</', tagName, '>']);
      return h('div.element', [startTag, this.renderXmlNodes(node.childNodes), endTag]);
    }
    else {
      return h('span', `(Ignoring node type = ${node.nodeType})`);
    }
  }

  render(xml: string): VNode {
    var document = new DOMParser().parseFromString(xml, 'application/xml');
    return h('div', this.renderXmlNodes(document.childNodes));
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
        if (xml) {
          var blacklist = [
            // revision information
            'w:rsid', 'w:rsidR', 'w:rsidRDefault', 'w:rsidRPr', 'w:rsidP',
            // font information
            'w:rFonts', 'w:ascii', 'w:hAnsi', 'w:cs', 'w:bidi',
            // font size information
            'w:sz', 'w:szCs',
            // list item user interface config
            'w:nsid', 'w:multiLevelType', 'w:tmpl',
          ];
          var new_vtree = new XMLRenderer(blacklist).render(xml);
          update(new_vtree);
        }
      });
    }
  };
});
