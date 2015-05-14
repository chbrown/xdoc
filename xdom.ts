/// <reference path="type_declarations/index.d.ts" />
import adts = require('adts');
import {VNode, h} from 'virtual-dom';

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export class XNode {
  textContent: string;
  constructor(public childNodes: XNode[] = []) { }
  toVNode(): VNode {
    if (this.textContent) {
      return h('span', this.textContent);
    }
    else {
      return h('span', this.childNodes.map(childNode => childNode.toVNode()));
    }
  }
  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
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
  /**
  Output is similar to XNode's, but returns an actual HTML DOM element,
  a div.paragraph, rather than a document fragment
  */
  toVNode(): VNode {
    return h('div.paragraph', this.childNodes.map(childNode => childNode.toVNode()));
  }
  /** Returns a string */
  toTeX(): string {
    throw new Error('Not yet implemented');
  }
}

export class XDocument extends XNode {
  metadata: Map<string>; // {[index: string]: string};
  constructor(childNodes: Array<XNode>, metadata: Map<string>) {
    super(childNodes);
    this.metadata = metadata;
  }
}

/**
XSpan is the basic text block of a document, associated with a single
basic string and maybe some styles.
*/
export class XSpan extends XNode {
  constructor(public textContent: string, public styles: adts.Set) { super() }
  toVNode(): VNode {
    var classList: string[] = [];
    if (this.styles.contains('italic')) {
      classList.push('italic');
    }
    if (this.styles.contains('bold')) {
      classList.push('bold');
    }
    return h('span', {className: classList.join(' ')}, [this.textContent]);
  }
}

export class XFootnote extends XNode {
  toVNode(): VNode {
    return h('div.footnote', [super.toVNode()]);
  }
}

export class XEndnote extends XNode {
  toVNode(): VNode {
    return h('div.endnote', [super.toVNode()]);
  }
}
