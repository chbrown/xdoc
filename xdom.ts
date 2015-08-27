/// <reference path="type_declarations/index.d.ts" />
import _ = require('lodash');
import {VNode, VChild, VProperties, h} from 'virtual-dom';
import {t, e, stringifyXNodes, stringifyXTexts} from './latex';
import {log, join} from './util';
import {pushAll, flatMap} from 'arrays';

var objectAssign = require('object-assign');

/** We can do bitwise math in Javascript up to 2^29, so we can have up to
29 styles.
    2 << 29 ==  1073741824 == 2^30
    2 << 30 == -2147483648 != 2^31
But maybe it isn't the best design for Style to be an Enum?
Think of the colors!
20150602 12:20:40
*/
export enum Style {
  Bold = 1,
  Italic = 2,
  Underline = 4,
  Subscript = 8,
  Superscript = 16,
}

interface StyleDeclaration {
  fontSize?: string;
  fontStyle?: string;
  fontWeight?: string;
  textDecoration?: string;
  verticalAlign?: string;
}

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export class XNode {
  constructor() { }

  toVChild(): VChild {
    throw new Error('Cannot call .toVChild() on abstract class "XNode"');
  }
  toLaTeX(): string {
    throw new Error('Cannot call .toLaTeX() on abstract class "XNode"');
  }
  toJSON() {
    throw new Error('Cannot call .toJSON() on abstract class "XNode"');
  }
}

/**
When XText#styles == null that signifies wildcard styles, usually used for whitespace.
*/
export class XText extends XNode {
  constructor(public data: string,
              public styles: number = 0) { super() }

  toVChild(): VChild {
    return this.data;
  }
  toLaTeX(): string {
    // normally, this won't be called
    throw new Error('Cannot call XText#toLaTeX(); use latex.stringifyXTexts() instead');
  }
  toJSON() {
    return {
      styles: this.styles,
      data: this.data
    };
  }
}

export class XTextContainer extends XNode {
  constructor(public xTexts: XText[] = []) { super() }
  toLaTeX(): string {
    return stringifyXTexts(this.xTexts);
  }
}

export class XReference extends XNode {
  constructor(public code: string, public childNodes: XNode[] = []) { super() }

  toVChild(): VNode {
    return h('span.reference', {}, `code=${this.code}`);
    // this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('Cref', this.code);
  }
  toJSON() {
    return {
      type: 'reference',
      code: this.code,
    };
  }
}

/**
Output is similar to XNode's, but returns an actual HTML DOM element,
a div.paragraph, rather than a document fragment.

Paragraphs can only have XElements (and subclasses) as children, never naked
XOldText nodes.
*/
export class XContainer extends XNode {
  labels: string[] = [];
  constructor(public childNodes: XNode[] = []) { super() }

  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
  }
  appendChildren(newChildren: XNode[]) {
    pushAll(this.childNodes, newChildren);
  }

  toVChild(): VNode {
    // var properties = {};
    // properties['title'] = `labels=${this.labels.join(',')}`;
    return h('div.container', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return stringifyXNodes(this.childNodes) + this.labels.map(label => t('label', label)).join('');
  }
  toJSON() {
    return {
      type: 'container',
      labels: this.labels,
      children: this.childNodes.map(childNode => childNode.toJSON()),
    }
  }
}

export class XExample extends XContainer {
  toVChild(): VNode {
    var node = super.toVChild();
    node.properties['className'] += ' example';
    return node;
  }
  toLaTeX(): string {
    var content = super.toLaTeX();
    return `\\begin{exe}
  \\ex ${content}
\\end{exe}`;
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'example'});
  }
}

export class XSection extends XContainer {
  toVChild(): VNode {
    return h('span.section', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('section', super.toLaTeX());
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'section'});
  }
}

export class XSubsection extends XContainer {
  toVChild(): VNode {
    return h('span.subsection', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('subsection', super.toLaTeX());
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'subsection'});
  }
}

export class XSubsubsection extends XContainer {
  toVChild(): VNode {
    return h('span.subsubsection', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('subsubsection', super.toLaTeX());
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'subsubsection'});
  }
}

export class XDocument extends XContainer {
  constructor(public metadata: Map<string>, childNodes: XNode[] = []) { super(childNodes) }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'document'});
  }
}

export class XFootnote extends XContainer {
  toVChild(): VNode {
    return h('span.footnote', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    // a lot of people like to add space in front of all their footnotes.
    // this is kind of a hack to remove it.
    var contents = super.toLaTeX().replace(/^\s+/, '');
    return t('footnote', contents);
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'footnote'});
  }
}

export class XEndnote extends XContainer {
  toVChild(): VNode {
    return h('span.endnote', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    var contents = super.toLaTeX().replace(/^\s+/, '');
    return t('endnote', contents);
  }
  toJSON() {
    return objectAssign(super.toJSON(), {type: 'endnote'});
  }
}
