/// <reference path="type_declarations/index.d.ts" />
import _ = require('lodash');
import adts = require('adts');
import {VNode, VChild, VProperties, h} from 'virtual-dom';
import {replacements, replacementRegExp} from './latex';
import {log, pushAll} from './util';

// We can do bitwise math in Javascript up to 2^29, so we can have up to
// 29 styles
// 2 << 29 ==  1073741824 == 2^30
// 2 << 30 == -2147483648 != 2^31
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

function t(command: string, content: string): string {
  return `\\${command}{${content}}`;
}

function stringToLaTeX(raw: string): string {
  return raw.replace(replacementRegExp, match => replacements[match]);
}

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export class XNode {
  constructor() { }

  get textContent(): string {
    return '';
  }

  isWhitespace(): boolean {
    return true;
  }

  toVChild(): VChild {
    return h('span', '');
  }
  toLaTeX(): string {
    return '';
  }

  /**
  The basic normalization is a no-op.
  */
  normalize() { }
}

export class XText extends XNode {
  constructor(public data: string) { super() }

  get textContent(): string {
    return this.data;
  }

  isWhitespace(): boolean {
    return /^\s+$/.test(this.data);
  }

  toVChild(): VChild {
    return this.data;
  }
  toLaTeX(): string {
    return stringToLaTeX(this.data);
  }
}

export class XElement extends XNode {
  constructor(public childNodes: XNode[] = [],
              public styles: number = 0) { super() }

  get textContent(): string {
    // this check and throw is kind of rude
    // if (!this.containsOnlyText()) {
    //   throw new Error('Cannot get textContent of XElement with non-XText childNodes');
    // }
    return this.childNodes.map(childNode => childNode.textContent).join('');
  }

  isWhitespace(): boolean {
    return this.childNodes.every(childNode => childNode.isWhitespace());
  }

  containsOnlyText(): boolean {
    return this.childNodes.every(childNode => childNode instanceof XText);
  }

  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
  }
  appendChildren(newChildren: XNode[]) {
    pushAll(this.childNodes, newChildren);
  }

  getVProperties(): VProperties {
    // could be CSSStyleDeclaration but all the properties are required
    var style: StyleDeclaration = {};
    if (this.styles & Style.Italic) {
      style.fontStyle = 'italic';
    }
    if (this.styles & Style.Bold) {
      style.fontWeight = 'bold';
    }
    if (this.styles & Style.Underline) {
      style.textDecoration = 'underline';
    }

    // it'd be weird if something was both subscript and superscript, but maybe?
    if (this.styles & Style.Subscript) {
      style.verticalAlign = 'sub';
      style.fontSize = 'xx-small';
    }
    if (this.styles & Style.Superscript) {
      style.verticalAlign = 'super';
      style.fontSize = 'xx-small';
    }

    // use `|| undefined` to avoid creating an empty title attribute
    var title = undefined; // this.styles.toJSON().join('; ') ||

    return {style: style, title: title};
  }
  toVChild(): VNode {
    return h('span.element', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    var content = this.childNodes.map(childNode => childNode.toLaTeX()).join('');
    if (this.styles & Style.Italic) {
      content = t('textit', content);
    }
    if (this.styles & Style.Bold) {
      content = t('textbf', content);
    }
    if (this.styles & Style.Underline) {
      content = t('underline', content);
    }

    // it'd be weird if something was both subscript and superscript, but maybe?
    if (this.styles & Style.Subscript) {
      content = t('textsubscript', content);
    }
    if (this.styles & Style.Superscript) {
      content = t('textsuperscript', content);
    }
    return content;
  }

  normalize() {
    this.childNodes.forEach(childNode => childNode.normalize());
  }
}

/**
Output is similar to XNode's, but returns an actual HTML DOM element,
a div.paragraph, rather than a document fragment.

Paragraphs can only have XElements (and subclasses) as children, never naked
XText nodes.
*/
export class XParagraph extends XElement {
  childNodes: XElement[];
  labels: string[] = [];
  constructor(childNodes: XElement[] = [],
              styles: number = 0) { super(childNodes, styles) }

  toVChild(): VNode {
    var properties = this.getVProperties();
    properties['title'] = `labels=${this.labels.join(',')}`;
    return h('div.paragraph', properties,
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return '\n' + super.toLaTeX() + this.labels.map(label => t('label', label)).join('') + '\n';
  }

  /**
  We will generally normalize a XParagraph's children, which are most often
  plain XElements that have one child: an XText. This is the typical
  representation of text runs (w:r) within a text paragraph (w:p).

  We want to take groups of these XElements that have the same styles, and merge
  them into a single XElement with multiple XText children.

  We do this because Word's text runs (w:r) are often needlessly broken into
  several identically styled subsequences.

  It also produces more pleasant whitespace. Since most whitespace looks the same,
  whether it's normal, bold, italic, or anything else, Word will often create
  superfluous subsequences so that the whitespace runs and their surroundings
  are broken into several subsequences, though there is no reason to do so.

  You don't notice this in Word, because you don't see the styling markup, but
  it often produces very ugly LaTeX.

  Normalization is currently done in-place, since that's easier.

  * Find groups of contiguous styles (whitespace has flexible styles),
    but de-style whitespace outside such groups.
  * Previously, this would simply have empty or total-whitespace spans
    adopt the styles of the most recent non-whitespace span, but that
    isn't pretty.

  TODO: shave off trailing whitespace, so that whitespace is unstyled whenever possible.
  */
  normalize() { // : XParagraph
    // normalized_childNodes will replace this XParagraph's childNodes when complete
    var normalized_childNodes: XElement[] = [];
    // buffer and buffer_styles will be periodically flushed
    var buffer: XElement[] = [];
    // `buffer_styles` could be computed from `buffer` each time it's needed,
    // but it's just as easy to keep track of it separately
    var buffer_styles: number;

    /**
    merging takes a list of spans, joins all of the text together,
    and only keeps the styles.

    We assume that all of the nodes have the same styles.
    */
    function flush() {
      // normalize each of the collected nodes
      buffer.forEach(childNode => childNode.normalize());
      var merged_textContent = buffer.map(childNode => childNode.textContent).join('');
      var merged_childNode = new XElement([new XText(merged_textContent)], buffer_styles);
      normalized_childNodes.push(merged_childNode);
      // reset the buffer variables
      buffer = []
      buffer_styles = undefined;
    }

    this.childNodes.forEach(childNode => {
      var containsOnlyText = childNode.containsOnlyText();
      // only-whitespace always counts as the same style; it's like it has wildcard styles
      if (childNode.isWhitespace()) {
        buffer.push(childNode);
      }
      // if we don't have any current styles, we set them to whatever comes up first
      else if (buffer_styles === undefined && containsOnlyText) {
        buffer.push(childNode);
        buffer_styles = childNode.styles;
      }
      // if this node's styles match the current styles, cool, just add it onto the buffer
      else if (childNode.styles === buffer_styles && containsOnlyText) {
        buffer.push(childNode);
      }
      // otherwise, it's a style mismatch, so we flush and continue, setting the styles to the offending node's styles
      else {
        flush();
        buffer.push(childNode);
        buffer_styles = childNode.styles;
      }
    });

    // finish up with a final flush
    flush();

    this.childNodes = normalized_childNodes;
  }
}

export class XExample extends XParagraph {
  toVChild(): VNode {
    var node = super.toVChild();
    node.properties['className'] += ' example';
    return node;
  }
  toLaTeX(): string {
    return '\n' + t(`example`, super.toLaTeX().trim()) + '\n';
  }
}

export class XReference extends XElement {
  constructor(public code: string,
              childNodes: XNode[] = [],
              styles: number = 0) {
    super(childNodes, styles);
  }

  toVChild(): VNode {
    var properties = this.getVProperties();
    properties['title'] = `code=${this.code}`;
    return h('span.reference', properties,
      this.childNodes.map(childNode => childNode.toVChild()));
  }

  toLaTeX(): string {
    return t('Cref', this.code);
  }
}

export class XDocument extends XElement {
  constructor(public metadata: Map<string>, childNodes: XNode[] = []) { super(childNodes) }
}

/**
XSpan is the basic text block of a document, associated with a single
basic string and maybe some styles.

childNodes should always be empty.
*/

export class XFootnote extends XElement {
  toVChild(): VNode {
    return h('span.footnote', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('footnote', super.toLaTeX());
  }
}

export class XEndnote extends XElement {
  toVChild(): VNode {
    return h('span.endnote', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVChild()));
  }
  toLaTeX(): string {
    return t('endnote', super.toLaTeX());
  }
}
