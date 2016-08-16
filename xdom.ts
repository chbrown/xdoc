import {VNode, VChild, VProperties, h} from 'virtual-dom';
import {t, e, stringifyXNodes, stringifyXTexts} from './latex';
import {join} from './util';

interface Map<V> { [index: string]: V }

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
    return h('span', this.data);
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
    return h('div.reference', {}, `code=${this.code}`);
    // this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('Cref', this.code);
  }
  toJSON() {
    return {
      name: 'reference',
      code: this.code,
      children: this.childNodes,
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
    this.childNodes.push(...newChildren);
  }

  toVChild(): VNode {
    // const properties = {};
    // properties['title'] = `labels=${this.labels.join(',')}`;
    return h('div.container', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return stringifyXNodes(this.childNodes) + this.labels.map(label => t('label', label)).join('');
  }
  toJSON() {
    return {
      name: 'container',
      labels: this.labels,
      children: this.childNodes.map(childNode => childNode.toJSON()),
    }
  }
}

/**
Generally, the 'name' of an XNamedContainer will be a LaTeX command, like
'section' or 'footnote'.
*/
export class XNamedContainer extends XContainer {
  constructor(childNodes: XNode[] = [], public name: string = '') { super(childNodes) }
  toVChild(): VNode {
    return h('div', {className: this.name},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t(this.name, stringifyXNodes(this.childNodes)) + this.labels.map(label => t('label', label)).join('');
  }
  toJSON() {
    return Object.assign(super.toJSON(), {name: this.name});
  }
}

export class XSection extends XNamedContainer {
  constructor(childNodes: XNode[] = []) { super(childNodes, 'section') }
}

export class XSubsection extends XNamedContainer {
  constructor(childNodes: XNode[] = []) { super(childNodes, 'subsection') }
}

export class XSubsubsection extends XNamedContainer {
  constructor(childNodes: XNode[] = []) { super(childNodes, 'subsubsection') }
}

export class XExample extends XContainer {
  toVChild(): VNode {
    const node = super.toVChild();
    node.properties['className'] += ' example';
    return node;
  }
  toLaTeX(): string {
    const content = super.toLaTeX();
    return `\\begin{exe}
  \\ex ${content}
\\end{exe}`;
  }
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'example'});
  }
}

export class XDocument extends XContainer {
  constructor(public metadata: Map<string>, childNodes: XNode[] = []) { super(childNodes) }
  toVChild(): VNode {
    return h('div.document', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'document'});
  }
}

export class XFootnote extends XContainer {
  toVChild(): VNode {
    return h('div.footnote', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    // a lot of people like to add space in front of all their footnotes.
    // this is kind of a hack to remove it.
    const contents = super.toLaTeX().replace(/^\s+/, '');
    return t('footnote', contents);
  }
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'footnote'});
  }
}

export class XEndnote extends XContainer {
  toVChild(): VNode {
    return h('div.endnote', {},
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    const contents = super.toLaTeX().replace(/^\s+/, '');
    return t('endnote', contents);
  }
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'endnote'});
  }
}
