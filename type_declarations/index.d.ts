/// <reference path="DefinitelyTyped/angularjs/angular.d.ts" />
/// <reference path="DefinitelyTyped/jszip/jszip.d.ts" />
/// <reference path="DefinitelyTyped/lodash/lodash.d.ts" />
/// <reference path="DefinitelyTyped/mocha/mocha.d.ts" />
/// <reference path="DefinitelyTyped/react/react.d.ts" />
/// <reference path="DefinitelyTyped/virtual-dom/virtual-dom.d.ts" />

/// <reference path="../node_modules/adts/adts.d.ts" />
/// <reference path="../node_modules/arrays/arrays.d.ts" />
/// <reference path="../node_modules/coders/coders.d.ts" />
/// <reference path="../node_modules/notify-ui/notify-ui.d.ts" />

interface Map<V> { [index: string]: V }

// from node.d.ts
interface NodeRequireFunction {
    (id: string): any;
}
interface NodeRequire extends NodeRequireFunction {
    resolve(id:string): string;
}
declare var require: NodeRequire;
