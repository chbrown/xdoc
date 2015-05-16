/// <reference path="type_declarations/index.d.ts" />
import _ = require('lodash');
import adts = require('adts');
import {VNode, VProperties, h} from 'virtual-dom';
import {replacements, replacementRegExp} from './latex';
import {pushAll} from './util';

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

  toVNode(): VNode {
    return h('span', '');
  }
  toLaTeX(): string {
    return '';
  }
}

export class XText extends XNode {
  constructor(public data: string) { super() }

  toVNode(): VNode {
    return h('span', this.data);
  }
  toLaTeX(): string {
    return stringToLaTeX(this.data);
  }
}

export class XElement extends XNode {
  constructor(public childNodes: XNode[] = [],
              public styles: number = 0) { super() }

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
  toVNode(): VNode {
    return h('span', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVNode()));
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

  /** modifies this WordContainer's children so that contiguous WordSpan
  objects with the congruent styles are merged into a single WordSpan.
  This is mostly about whitespace; smoothing out whitespace where possible to
  match neighbors.

  It's easiest to modify existing Span objects, so style cleaning is done in-place

  * Find groups of contiguous styles (whitespace has flexible styles),
    but de-style whitespace outside such groups.
  * Previously, this would simply have empty or total-whitespace spans
    adopt the styles of the most recent non-whitespace span, but that
    isn't pretty.

   TODO: fix implementation
  */
  normalize(): XNode {
    throw new Error('Not yet implemented');
    // inner_spans and outer_spans are temporary lists of spans
    // var inner_spans = [];
    // var outer_spans = [];
    // // var current_styles = [];
    // _.each(this.spans, function(span) {
    //   // we only want spans that are empty / only whitespace
    //   if (span.isWhitespace()) {
    //     outer_spans.push(span);
    //   }
    //   else if (_.xor(span.styles, current_styles).length > 0) {
    //     // if this span's styles are the same as the current styles
    //     // a non-empty span with identical styles triggers:
    //     // merging outer_spans into inner_spans
    //     inner_spans = inner_spans.concat(outer_spans);
    //     outer_spans = [];
    //   }
    //   else {
    //     // a non-empty span with new styles triggers:
    //     // 1) applying current_styles to all inner_spans
    //     for (span in inner_spans) {
    //       span.styles = current_styles;
    //     }
    //     inner_spans = []
    //     // 2) erasing all styles from outer_spans
    //     for span in outer_spans:
    //         span.styles = set()
    //     outer_spans = []
    //     // 3) setting current_styles
    //     current_styles = span.styles
    //   }
    // });

    // // now that the styles are all sanitized and updated, we can use the standard groupby
    // span_group_iter = itertools.groupby(self.spans, lambda span: span.styles)
    // self.spans = [Span.merge(span_group) for styles, span_group in span_group_iter]
    // return this;
    // WordSpan....merge = function(spans) {
    //   /** WordSpan.merge takes a list of spans, joins all of the text together,
    //      and only keeps the attributes
    //   */
    //   var first = spans[0];
    //   if (first === undefined) throw new Error('You cannot merge an empty list');
    //   var text = _.pluck(spans, 'text').join('');
    //   return new WordSpan(text, first.styles, first.attrs);
    // };
  }
}

export class XParagraph extends XElement {
  /**
  Output is similar to XNode's, but returns an actual HTML DOM element,
  a div.paragraph, rather than a document fragment
  */
  toVNode(): VNode {
    return h('div.paragraph', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVNode()));
  }
  toLaTeX(): string {
    return '\n' + super.toLaTeX() + '\n';
  }
}

export class XExample extends XParagraph {
  label: string;
  toVNode(): VNode {
    var properties = this.getVProperties();
    properties['title'] = `label=${this.label}`;
    return h('div.paragraph.example', properties,
      this.childNodes.map(childNode => childNode.toVNode()));
  }
  toLaTeX(): string {
    return t(`example[${this.label}]`, super.toLaTeX());
  }
}

export class XReference extends XElement {
  constructor(public code: string,
              childNodes: XNode[] = [],
              styles: number = 0) {
    super(childNodes, styles);
  }

  toVNode(): VNode {
    // var bookmark = parser.bookmarks[complexField.code]
    var properties = this.getVProperties();
    properties['title'] = `code=${this.code}`;
    return h('span.reference', properties,
      this.childNodes.map(childNode => childNode.toVNode()));
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
  toVNode(): VNode {
    return h('span.footnote', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVNode()));
  }
  toLaTeX(): string {
    return t('footnote', super.toLaTeX());
  }
}

export class XEndnote extends XElement {
  toVNode(): VNode {
    return h('span.endnote', this.getVProperties(),
      this.childNodes.map(childNode => childNode.toVNode()));
  }
  toLaTeX(): string {
    return t('endnote', super.toLaTeX());
  }
}
