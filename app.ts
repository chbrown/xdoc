/// <reference path="type_declarations/index.d.ts" />
import {VNode, VChild, h, create, diff, patch} from 'virtual-dom';

import JSZip = require('jszip');
import docx = require('./formats/docx');
import {base64} from 'coders';
import {log, flatten, list} from './util';
import xdom = require('./xdom');

interface StoredFileJSON {
  name: string;
  size: number;
  type: string;
  lastModifiedDate: any;
  data: string;
}

class StoredFile {
  constructor(public name: string,
              public size: number,
              public type: string,
              public lastModifiedDate: any,
              private data_base64?: string,
              private data_arrayBuffer?: ArrayBuffer) { }

  get key(): string {
    return `storedfile:${this.name}`;
  }

  /**
  If neither `data_base64` nor `data_arrayBuffer` are available, this method
  will fail.
  */
  get base64(): string {
    if (this.data_base64 === undefined) {
      var bytes = new Uint8Array(this.data_arrayBuffer);
      this.data_base64 = base64.encodeBytesToString(bytes);
    }
    return this.data_base64;
  }
  /**
  If neither `data_base64` nor `data_arrayBuffer` are available, this method
  will fail.

  This cached getter allows us to load the file metadata for several stored
  files without having to read the decode the base64 into ArrayBuffer until we
  need it.
  */
  get arrayBuffer(): ArrayBuffer {
    if (this.data_arrayBuffer === undefined) {
      var bytes = base64.decodeStringToBytes(this.data_base64);
      this.data_arrayBuffer = new Uint8Array(bytes).buffer;
    }
    return this.data_arrayBuffer;
  }

  /**
  When stored as JSON, a StoredFile has its data encoded as a Base64 string,
  under the key `data`.
  */
  static fromJSON(object: StoredFileJSON): StoredFile {
    return new StoredFile(object.name, object.size, object.type, object.lastModifiedDate, object.data);
  }
  toJSON(): StoredFileJSON {
    return {
      name: this.name,
      size: this.size,
      type: this.type,
      lastModifiedDate: this.lastModifiedDate,
      data: this.base64,
    };
  }
}

var app = angular.module('app', [
  'ui.router',
  'ngStorage',
  'misc-js/angular-plugins',
]);

app.directive('uiSrefActiveAny', function($state) {
  return {
    restrict: 'A',
    scope: {
      uiSrefActiveAny: '=',
    },
    link: function(scope, el) {
      var activeClasses = scope.uiSrefActiveAny;
      function updateSrefActiveAny() {
        for (var key in activeClasses) {
          var match = $state.includes(activeClasses[key]);
          el.toggleClass(key, match);
        }
      }
      scope.$on('$stateChangeSuccess', updateSrefActiveAny);
    }
  };
});

app.config(($stateProvider, $urlRouterProvider) => {
  $urlRouterProvider.otherwise(($injector, $location) => {
    log('otherwise: coming from "%s"', $location.url());
    return '/';
  });

  $stateProvider
  .state('documents', {
    url: '/',
    templateUrl: 'templates/documents.html',
    controller: 'documentsCtrl',
  })
  .state('document', {
    url: '/:name',
    templateUrl: 'templates/document.html',
    controller: 'documentCtrl',
    abstract: true,
  })
  .state('document.files', {
    url: '/files',
    templateUrl: 'templates/files.html',
  })
  .state('document.files.xml', {
    url: '/:filepath/xml',
    templateUrl: 'templates/xml.html',
    controller: 'documentFileXmlCtrl',
  })
  .state('document.xdoc', {
    url: '/xdoc',
    templateUrl: 'templates/xdoc.html',
    controller: 'documentXDocCtrl',
  })
  // .state('validate', {
  //   url: '/validate',
  //   templateUrl: 'templates/validate.html',
  // });
  .state('document.latex', {
    url: '/latex',
    templateUrl: 'templates/latex.html',
    controller: 'documentLaTeXCtrl',
  });
});

app.controller('documentsCtrl', ($scope, $flash) => {
  var storedFiles: StoredFile[] = Object.keys(localStorage)
    .filter(key => key.match(/^storedfile:/) !== null)
    .map(key => StoredFile.fromJSON(JSON.parse(localStorage.getItem(key))));

  $scope.storedFiles = storedFiles;

  /**
  ng-onupload triggers this handler from the documents view/template.
  */
  $scope.readFile = (file: File) => {
    var reader = new FileReader();
    reader.onerror = err => {
      $scope.$apply(() => { throw err; });
    };
    reader.onload = ev => {
      $scope.$apply(() => {
        var storedFile = new StoredFile(file.name, file.size, file.type, file.lastModifiedDate, undefined, reader.result);
        localStorage.setItem(storedFile.key, JSON.stringify(storedFile));
        $flash(`Loaded file "${storedFile.name}" and saved in localStorage`);
        storedFiles.push(storedFile);
      });
    };
    reader.readAsArrayBuffer(file);
  };

  /**
  the "remove" button triggers this handler from the documents view/template.
  */
  $scope.removeStoredFile = (storedFile: StoredFile) => {
    localStorage.removeItem(storedFile.key);
    var index = storedFiles.indexOf(storedFile);
    storedFiles.splice(index, 1);
  };
});

app.controller('documentCtrl', ($scope, $state) => {
  var storedFile: StoredFile = StoredFile.fromJSON(JSON.parse(localStorage.getItem(`storedfile:${$state.params.name}`)));

  $scope.storedFile = storedFile;
  // zip is only used in the document.files sub-state
  $scope.zip = new JSZip(storedFile.arrayBuffer);
});

app.controller('documentFileXmlCtrl', ($scope, $state) => {
  var storedFile: StoredFile = $scope.storedFile;
  var zip: JSZip = $scope.zip;

  var file = $scope.file = zip.file($state.params.filepath);
  var text = $scope.text = file.asText();
});

app.controller('documentXDocCtrl', ($scope, $localStorage) => {
  // $localStorage is only used for the preview configuration settings, like labels and outlines
  $scope.$storage = $localStorage.$default({labeled: true});

  var storedFile: StoredFile = $scope.storedFile;

  var parser = new docx.Parser(storedFile.arrayBuffer);
  $scope.document = parser.document;
});

app.controller('documentLaTeXCtrl', ($scope) => {
  $scope.timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');

  var storedFile: StoredFile = $scope.storedFile;

  var parser = new docx.Parser(storedFile.arrayBuffer);
  $scope.latex = parser.document.toLaTeX();
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
