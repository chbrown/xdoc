import {join} from './util';

/** We can do bitwise math in Javascript up to 2^29, so we can have up to
29 styles.
    2 << 29 ==  1073741824 == 2^30
    2 << 30 == -2147483648 != 2^31
But maybe it isn't the best design for Style to be an Enum?
Think of the colors!
*/
export enum Style {
  Bold = 1,
  Italic = 2,
  Underline = 4,
  Subscript = 8,
  Superscript = 16,
}

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export abstract class XNode {
  constructor() { }

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

  toJSON() {
    return {
      styles: this.styles,
      data: this.data
    };
  }
}

export class XReference extends XNode {
  constructor(public code: string,
              public childNodes: XNode[] = []) { super() }

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
  constructor(public childNodes: XNode[] = [],
              public labels: string[] = []) { super() }

  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
  }
  appendChildren(newChildren: XNode[]) {
    this.childNodes.push(...newChildren);
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
  constructor(childNodes: XNode[] = [],
              public name: string = '') { super(childNodes) }
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
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'example'});
  }
}

export class XDocument extends XContainer {
  constructor(public metadata: { [index: string]: string },
              childNodes: XNode[] = []) { super(childNodes) }
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'document'});
  }
}

export class XFootnote extends XContainer {
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'footnote'});
  }
}

export class XEndnote extends XContainer {
  toJSON() {
    return Object.assign(super.toJSON(), {name: 'endnote'});
  }
}

export function isXText(node: XNode): node is XText {
  return node instanceof XText;
}
export function isXReference(node: XNode): node is XReference {
  return node instanceof XReference;
}
export function isXContainer(node: XNode): node is XContainer {
  return node instanceof XContainer;
}
export function isXNamedContainer(node: XNode): node is XNamedContainer {
  return node instanceof XNamedContainer;
}
export function isXExample(node: XNode): node is XExample {
  return node instanceof XExample;
}
export function isXDocument(node: XNode): node is XDocument {
  return node instanceof XDocument;
}
export function isXFootnote(node: XNode): node is XFootnote {
  return node instanceof XFootnote;
}
export function isXEndnote(node: XNode): node is XEndnote {
  return node instanceof XEndnote;
}
