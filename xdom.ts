/// <reference path="type_declarations/index.d.ts" />
import _ = require('lodash');
import adts = require('adts');
import {VNode, VProperties, h} from 'virtual-dom';

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

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export class XNode {
  constructor(public childNodes: XNode[] = [],
              public textContent: string = null,
              public styles: number = 0) { }

  getProperties(): VProperties {
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
  getContent() {
    return this.textContent ? this.textContent : this.childNodes.map(childNode => childNode.toVNode());
  }
  toVNode(): VNode {
    return h('span', this.getProperties(), this.getContent());
  }
  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
  }
  appendChildren(newChildren: XNode[]) {
    Array.prototype.push.apply(this.childNodes, newChildren);
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

export class XParagraph extends XNode {
  pStyle: string;
  /**
  Output is similar to XNode's, but returns an actual HTML DOM element,
  a div.paragraph, rather than a document fragment
  */
  toVNode(): VNode {
    return h('div.paragraph', this.getProperties(),
      [this.pStyle ? `pStyle=${this.pStyle}` : '', this.getContent()]);
  }
}

export class XReference extends XNode {
  constructor(public code: string,
              childNodes: XNode[] = [],
              textContent: string = null,
              styles: number = 0) {
    super(childNodes, textContent, styles);
  }

  toVNode(): VNode {
    // var bookmark = parser.bookmarks[complexField.code]
    return h('span.reference', this.getProperties(), this.getContent());
  }
}

export class XDocument extends XNode {
  constructor(public metadata: Map<string>) { super() }
}

/**
XSpan is the basic text block of a document, associated with a single
basic string and maybe some styles.

childNodes should always be empty.
*/

export class XFootnote extends XNode {
  toVNode(): VNode {
    return h('span.footnote', this.getProperties(), this.getContent());
  }
}

export class XEndnote extends XNode {
  toVNode(): VNode {
    return h('span.endnote', this.getProperties(), this.getContent());
  }
}
