/*jslint browser: true */
/// <reference path="typings/tsd.d.ts" />

import domlib = require('./domlib');
var El = domlib.El;

interface Map<K extends string, V> { [index: string]: V }

import ds = require('./datastructures');
//var Set = ds.Set;

export class XNode {
  /** A fragment of a Document model; can be either a container,
   * or, when extended, a node with some semantic role in a document.
  */
  childNodes: Array<XNode>;
  textContent: string;
  constructor(childNodes: Array<XNode> = []) {
    this.childNodes = childNodes;
  }
  toDOM(): Node {
    if (this.textContent) {
      return document.createTextNode(this.textContent);
    }
    else {
      var el = document.createDocumentFragment();
      this.childNodes.forEach(function(childNode) {
        el.appendChild(childNode.toDOM());
      });
      return el;
    }
  }
  appendChild(newChild: XNode) {
    this.childNodes.push(newChild);
  }
  normalize(): XNode {
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
  toDOM() {
    /** Output is similar to XNode's, but returns an actual HTML DOM element,
     * a div.paragraph, rather than a document fragment
     */
    var el = document.createElement('div');
    el.className = 'paragraph';

    this.childNodes.forEach(function(childNode) {
      el.appendChild(childNode.toDOM());
    });

    return el;
  }
  toTeX() {
    /** Returns a string */
    throw new Error('Not yet implemented');
  }
}

export class XDocument extends XNode {
  metadata: Map<string, string>; // {[index: string]: string};
  constructor(childNodes: Array<XNode>, metadata: Map<string, string>) {
    super(childNodes);
    this.metadata = metadata;
  }
}

export class XSpan extends XNode {
  /** Span is the basic text block of a document, associated with a single
   unadorned string and maybe some styles.
   */
  textContent: string;
  styles: ds.Set;
  constructor(textContent: string, styles: ds.Set) {
    super();
    this.textContent = textContent;
    this.styles = styles;
  }
  toDOM() {
    var span = El('span', {}, [this.textContent]);

    if (this.styles.contains('italic')) {
      span.classList.add('italic');
    }

    if (this.styles.contains('bold')) {
      span.classList.add('bold');
    }

    return span;
  }
}

export class XFootnote extends XNode {
  toDOM() {
    return El('div', {'class': 'footnote'}, [super.toDOM()]);
  }
}

export class XEndnote extends XNode {
  toDOM() {
    return El('div', {'class': 'endnote'}, [super.toDOM()]);
  }
}
