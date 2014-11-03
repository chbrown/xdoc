/*jslint browser: true */
/// <reference path="typings/tsd.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
define(["require", "exports", './domlib'], function (require, exports, domlib) {
    var El = domlib.El;
    //var Set = ds.Set;
    var XNode = (function () {
        function XNode(childNodes) {
            if (childNodes === void 0) { childNodes = []; }
            this.childNodes = childNodes;
        }
        XNode.prototype.toDOM = function () {
            if (this.textContent) {
                return document.createTextNode(this.textContent);
            }
            else {
                var el = document.createDocumentFragment();
                this.childNodes.forEach(function (childNode) {
                    el.appendChild(childNode.toDOM());
                });
                return el;
            }
        };
        XNode.prototype.appendChild = function (newChild) {
            this.childNodes.push(newChild);
        };
        XNode.prototype.normalize = function () {
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
        };
        return XNode;
    })();
    exports.XNode = XNode;
    var XParagraph = (function (_super) {
        __extends(XParagraph, _super);
        function XParagraph() {
            _super.apply(this, arguments);
        }
        XParagraph.prototype.toDOM = function () {
            /** Output is similar to XNode's, but returns an actual HTML DOM element,
             * a div.paragraph, rather than a document fragment
             */
            var el = document.createElement('div');
            el.className = 'paragraph';
            this.childNodes.forEach(function (childNode) {
                el.appendChild(childNode.toDOM());
            });
            return el;
        };
        XParagraph.prototype.toTeX = function () {
            throw new Error('Not yet implemented');
        };
        return XParagraph;
    })(XNode);
    exports.XParagraph = XParagraph;
    var XDocument = (function (_super) {
        __extends(XDocument, _super);
        function XDocument(childNodes, metadata) {
            _super.call(this, childNodes);
            this.metadata = metadata;
        }
        return XDocument;
    })(XNode);
    exports.XDocument = XDocument;
    var XSpan = (function (_super) {
        __extends(XSpan, _super);
        function XSpan(textContent, styles) {
            _super.call(this);
            this.textContent = textContent;
            this.styles = styles;
        }
        XSpan.prototype.toDOM = function () {
            var span = El('span', {}, [this.textContent]);
            if (this.styles.contains('italic')) {
                span.classList.add('italic');
            }
            if (this.styles.contains('bold')) {
                span.classList.add('bold');
            }
            return span;
        };
        return XSpan;
    })(XNode);
    exports.XSpan = XSpan;
    var XFootnote = (function (_super) {
        __extends(XFootnote, _super);
        function XFootnote() {
            _super.apply(this, arguments);
        }
        XFootnote.prototype.toDOM = function () {
            return El('div', { 'class': 'footnote' }, [_super.prototype.toDOM.call(this)]);
        };
        return XFootnote;
    })(XNode);
    exports.XFootnote = XFootnote;
    var XEndnote = (function (_super) {
        __extends(XEndnote, _super);
        function XEndnote() {
            _super.apply(this, arguments);
        }
        XEndnote.prototype.toDOM = function () {
            return El('div', { 'class': 'endnote' }, [_super.prototype.toDOM.call(this)]);
        };
        return XEndnote;
    })(XNode);
    exports.XEndnote = XEndnote;
});
