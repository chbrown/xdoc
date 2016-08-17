import {base64} from 'coders';
import * as JSZip from 'jszip';
import {NotifyUI} from 'notify-ui';
import {VNode, VChild, h, create, diff, patch} from 'virtual-dom';
// import React from 'react';

var xmltree = require('xmltree/virtual-dom');

import {Parser} from './formats/docx';
import {XDocument} from './xdom';
import * as layouts from './layouts';

import './site.less';

// angular and libraries
import angular = require('angular');
import 'angular-ui-router';
import 'ngstorage';
import 'ng-upload';
import 'flow-copy';

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
  'ngUpload',
  'flow-copy',
]);

app.directive('uiSrefActiveAny', function($state) {
  return {
    restrict: 'A',
    scope: {
      uiSrefActiveAny: '=',
    },
    link: function(scope, el) {
      var activeClasses = scope['uiSrefActiveAny'];
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
    return '/';
  });

  $stateProvider
  .state('documents', {
    url: '/',
    template: `
      <section class="hpad">
        <h1><code>xdoc</code>: a Word-to-LaTeX converter.</h1>
        <h3>Instructions:</h3>
        <ol>
          <li>Load a Word document file using the input below. This file is only
            available to your browser; it is not uploaded to any server.</li>
          <li>Preview the automatically generated <code>xdoc</code> representation
            of your document using the "XDoc" link.</li>
          <li>Generate a LaTeX representation via the "LaTeX" link. Copy and paste the
            contents of that page into a file on your computer, and render it with
            <code>pdflatex</code>.</li>
        </ol>
        <p>Only modern Word documents (those with a <code>.docx</code> extension) are supported.</p>
      </section>

      <section class="hpad">
        <h2>Stored documents</h2>
        <p ng-show="storedFiles.length == 0">
          You have not loaded any files. A list of loaded files will appear here after you have uploaded one.
        </p>
      </section>
      <table ng-show="storedFiles.length > 0" class="fill padded lined striped">
        <thead>
          <tr>
            <th title="File name">Name</th>
            <th></th>
            <th></th>
            <th title="Original file contents size">Size</th>
            <!-- <th title="MIME Type">Type</th> -->
            <th title="Last modified date">Modified</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr ng-repeat="storedFile in storedFiles">
            <td><a ui-sref="document.files({name: storedFile.name})">{{storedFile.name}}</a></td>
            <td><a ui-sref="document.xdoc({name: storedFile.name})">XDoc</a></td>
            <td><a ui-sref="document.latex({name: storedFile.name})">LaTeX</a></td>
            <!-- the storedFile.base64 getter should not trigger a base64 conversion -->
            <td class="number" title="Base64 string length: {{storedFile.base64.length}}">{{storedFile.size}}</td>
            <!-- <td>{{storedFile.type}}</td> -->
            <td>{{storedFile.lastModifiedDate | date:'MMMM d, y h:mm a'}}</td>
            <td><button ng-click="removeStoredFile(storedFile)">Remove</button>
          </tr>
        </tbody>
      </table>

      <section class="hpad">
        <form>
          <label>
            <div><b>Load a new Word Document</b></div>
            <input type="file" ng-upload="readFile($file)">
          </label>
        </form>
      </section>
    `,
    controller: 'documentsCtrl',
  })
  .state('document', {
    url: '/:name',
    template: `
      <nav fixedflow class="sub">
        <span class="text">
          <b>{{storedFile.name}}</b>
        </span>
        <span ui-sref-active="current" class="tab">
          <a ui-sref="document.files">Files</a>
        </span>
        <span ui-sref-active="current" class="tab">
          <a ui-sref="document.xdoc">XDoc</a>
        </span>
        <!-- <span ui-sref-active="current" class="tab">
          <a ui-sref="validate">Validate</a>
        </span> -->
        <span ui-sref-active="current" class="tab">
          <a ui-sref="document.latex">LaTeX</a>
        </span>
      </nav>

      <ui-view></ui-view>
    `,
    controller: 'documentCtrl',
    abstract: true,
  })
  .state('document.files', {
    url: '/files',
    template: `
      <section class="hpad">
        <h3>Document zip archive contents</h3>
        <p>You can use this file to view the raw XML for all files inside the Word document.</p>
        <p>This is helpful for developing and debugging, but if you just want to convert your document, use the <a ui-sref="document.latex">LaTeX</a> link.
      </section>

      <table class="fill padded lined striped">
        <thead>
          <tr>
            <th>Name</th>
            <th>Dir</th>
            <th>Date</th>
            <th>Comment</th>
            <th>Permissions</th>
          </tr>
        </thead>
        <tbody>
          <tr ng-repeat="object in zip.files">
            <td><a ui-sref="document.files.xml({filepath: object.name})">{{object.name}}</a></td>
            <td>{{object.dir}}</td>
            <td>{{object.date}}</td>
            <td>{{object.comment}}</td>
            <td>{{object.unixPermissions || object.dosPermissions}}</td>
          </tr>
        </tbody>
      </table>

      <ui-view></ui-view>
    `,
  })
  .state('document.files.xml', {
    url: '/:filepath/xml',
    template: `
      <section class="hpad">
        <h4>Legend</h4>
        <ul class="xml">
          <li class="attribute">
            Attribute
            <ul class="attribute">
              <li class="name">Name</li>
              <li class="value">Value</li>
            </ul>
          </li>
          <li class="start">Start Tag</li>
          <li class="end">End Tag</li>
          <li class="text" style="margin: 0">Text</li>
        </ul>

        <h3>File: {{file.name}}</h3>
        <xml-tree xml="text" class="xml"></xml-tree>
      </section>
    `,
    controller: 'documentFileXmlCtrl',
  })
  .state('document.xdoc', {
    url: '/xdoc',
    template: `
      <section class="hpad">
        <h2>Metadata</h2>
        <ul>
          <li ng-repeat="(key, value) in document.metadata">{{key}}: {{value}}</li>
        </ul>
      </section>

      <section class="hpad">
        <h2>Document</h2>

        <div>
          <label><input type="checkbox" ng-model="$storage.outlined"> Show outlines around each span</label>
        </div>

        <div class="document" ng-class="{outlined: $storage.outlined}" xdom-document="document"></div>
      </section>
    `,
    controller: 'documentXDocCtrl',
  })
  .state('document.xdocjson', {
    url: '/xdocjson',
    template: `
      <section class="hpad">
        <h2>Document</h2>

        <pre ng-bind="document | json:'  '"></pre>
      </section>
    `,
    controller: 'documentXDocJSONCtrl',
  })
  // .state('validate', {
  //   url: '/validate',
  //   templateUrl: 'templates/validate.html',
  // });
  .state('document.latex', {
    url: '/latex',
    template: `
      <section class="hpad">
        <label>
          <b>Layout</b>
          <select ng-model="$storage.layout"
            ng-options="layout as layout for (layout, layoutFunction) in layouts"></select>
        </label>
        <a download="paper.tex">Download .tex</a>
      </section>

      <section class="hpad">
        <div class="latex" ng-bind="latex"></div>
      </section>
    `,
    controller: 'documentLaTeXCtrl',
  });
});

app.controller('documentsCtrl', ($scope) => {
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
        NotifyUI.add(`Loaded file "${storedFile.name}" and saved in localStorage`);
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

  var parser = new Parser(storedFile.arrayBuffer);
  var document = parser.document;
  $scope.document = document;
});

app.controller('documentXDocJSONCtrl', ($scope, $localStorage) => {
  var storedFile: StoredFile = $scope.storedFile;
  var parser = new Parser(storedFile.arrayBuffer);
  var document = parser.document;
  $scope.document = document;
});

app.controller('documentLaTeXCtrl', ($scope, $localStorage) => {
  $scope.$storage = $localStorage.$default({layout: 'plain'});

  var storedFile: StoredFile = $scope.storedFile;
  var parser = new Parser(storedFile.arrayBuffer);
  var document = parser.document;

  $scope.layouts = layouts;
  $scope.$watch('$storage.layout', (layout: string) => {
    if (layout) {
      $scope.latex = layouts[layout](document);
      // uggh, angular, why must you be so difficult?
      var data_url = `data:text/plain;charset=utf-8,${encodeURIComponent($scope.latex)}`;
      var anchor = window.document.querySelector('a[download]');
      anchor['href'] = data_url;
    }
    else {
      $scope.latex_href = '';
      $scope.latex = '';
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

      function update(xDocument: XDocument) {
        if (vtree === undefined) {
          vtree = xDocument.toVChild();
          element = create(vtree)
          // attach to the dom on the first draw
          el[0].appendChild(element);
        }
        else {
          var new_vtree = xDocument.toVChild();
          var patches = diff(vtree, new_vtree)
          element = patch(element, patches)
          vtree = new_vtree;
        }
      }

      scope.$watch('xdomDocument', (xDocument: XDocument) => {
        if (xDocument) {
          update(angular.copy(xDocument));
        }
      }, true);
    }
  };
});

app.directive('xmlTree', () => {
  return {
    restrict: 'E',
    scope: {
      xml: '=',
    },
    link: (scope, el) => {
      var container: Node = el[0];
      var element: Element;
      var vtree: VNode;

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
      var renderer = new xmltree.XMLRenderer(blacklist);

      scope.$watch('xml', (xml: string) => {
        if (xml) {
          [element, vtree] = renderer.update(xml, container, element, vtree);
        }
      });
    }
  };
});
