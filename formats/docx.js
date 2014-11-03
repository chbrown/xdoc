/// <reference path="../typings/tsd.d.ts" />
define(["require", "exports", 'jszip', '../datastructures', '../xdom', '../characters'], function (require, exports, JSZip, ds, xdom, characters) {
    //interface FixedElement extends Element {
    //  children: HTMLCollection;
    //}
    //var Element: {
    //  prototype: FixedElement;
    //  new(): FixedElement;
    //};
    //function childElements(node: Node): Array<Element> {
    //  var elements: Array<Element> = [];
    //  for (var i = 0, childNode; (childNode = node.childNodes[i]); i++) {
    //    if (childNode.nodeType == Node.ELEMENT_NODE) {
    //      elements.push(childNode);
    //    }
    //  }
    //  return elements;
    //}
    function eachChildElement(node, func) {
        for (var i = 0, childNode; (childNode = node.childNodes[i]); i++) {
            if (childNode.nodeType == Node.ELEMENT_NODE) {
                func(childNode);
            }
        }
        //_.each(node.childNodes, function(childNode) {
        //  if (childNode.nodeType == Node.ELEMENT_NODE) {
        //    func(childNode);
        //  }
        //});
    }
    var log = console.log.bind(console);
    var Context = (function () {
        function Context(footnotes, endnotes) {
            if (footnotes === void 0) { footnotes = {}; }
            if (endnotes === void 0) { endnotes = {}; }
            this.footnotes = footnotes;
            this.endnotes = endnotes;
            this.style_stack = [new ds.Set()];
        }
        Context.prototype.pushStyles = function (styles) {
            if (styles === void 0) { styles = []; }
            this.style_stack.push(new ds.Set(styles));
        };
        Context.prototype.popStyles = function () {
            return this.style_stack.pop();
        };
        Context.prototype.setStyles = function (styles) {
            this.style_stack[this.style_stack.length - 1] = styles;
        };
        Context.prototype.addStyles = function (styles) {
            var top = this.style_stack[this.style_stack.length - 1];
            this.setStyles(ds.Set.union([top, new ds.Set(styles)]));
        };
        Context.prototype.currentStyles = function () {
            /** Returns set (as instance of S) */
            return ds.Set.union(this.style_stack);
        };
        return Context;
    })();
    function parseXML(xml) {
        /** parseXML takes an XML string and returns a DOM Level 2/3 Document:
         https://developer.mozilla.org/en-US/docs/Web/API/document
         Uses the XML mode of the built-in DOMParser:
         https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
         */
        return new DOMParser().parseFromString(xml, 'application/xml');
    }
    function dropNS(qualifiedName) {
        /** Helper function (not exported) to drop the namespace part of a fully
        qualified name, e.g.:
      
            dropNS('w:r') -> 'r'
            dropNS('br') -> 'br'
        */
        return qualifiedName.replace(/^.+:/, '');
    }
    function readFootnotes(document) {
        /** Read the footnotes for a DocX document */
        var notes = {};
        _.each(document.documentElement.children, function (note) {
            var id = note.getAttribute('w:id');
            // each w:footnote has a bunch of w:p children, like a w:body
            var context = new Context();
            var container = readBody(note, context);
            notes[id] = new xdom.XFootnote(container.childNodes);
        });
        return notes;
    }
    function readEndnotes(document) {
        /** Read the endnotes for a DocX document */
        var notes = {};
        _.each(document.documentElement.children, function (note) {
            var id = note.getAttribute('w:id');
            // each w:endnote has a bunch of w:p children, like a w:body
            var context = new Context();
            var container = readBody(note, context);
            notes[id] = new xdom.XEndnote(container.childNodes);
        });
        return notes;
    }
    function readMetadata(core_document) {
        /** Turns the simple docProps/core.xml format into a key-value mapping after
        dropping namespaces. core_document should be a DOM Document; returns a plan
        Javascript hash object.
        */
        var metadata = {};
        _.each(core_document.documentElement.children, function (child) {
            var tag = dropNS(child.tagName);
            metadata[tag] = child.textContent;
        });
        return metadata;
    }
    function readRelationships(relationships_document) {
        /** The word/_rels/document.xml.rels looks kind of like:
      
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1"
            Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml"
            Target="../customXml/item1.xml"/>
          ...
          <Relationship Id="rId13"
            Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
            Target="http://dx.doi.org/10.1007/s11049-011-9137-1%20%20" TargetMode="External"/>
        </Relationships>
      
        */
        var relationships = {};
        _.each(relationships_document.documentElement.children, function (child) {
            var id = child.getAttribute('Id');
            relationships[id] = child.getAttribute('Target');
        });
        return relationships;
    }
    function readProperties(properties) {
        /** properties is an rPr or pPr element
      
        Returns a set of style strings (like "bold" or "italic"), as an instance of
        S (from sets.js)
        */
        var styles = new ds.Set();
        // everything we care about will an immediate child of the rPr or pPr
        eachChildElement(properties, function (child) {
            var tag = dropNS(child.tagName);
            var val = child.getAttribute('w:val');
            // italics (and bold, but with w:b) can be
            //   <w:rPr><w:i/></w:rPr> or <w:rPr><w:i w:val='1' /></w:rPr>
            //   but not <w:rPr><w:i w:val='0'/></w:rPr>
            if (tag == 'i' && val != '0') {
                styles._add('italic');
            }
            else if (tag == 'b' && val != '0') {
                styles._add('bold');
            }
            else if (tag == 'vertAlign' && val == 'subscript') {
                styles._add('subscript');
            }
            else if (tag == 'vertAlign' && val == 'superscript') {
                styles._add('superscript');
            }
            else if (tag == 'position' && val == '-4') {
                styles._add('subscript');
            }
            else if (tag == 'position' && val == '6') {
                styles._add('superscript');
            }
            else {
            }
        });
        return styles;
    }
    // readBody, readParagraph, and readRun all use and potentially manipulate the current context
    function readBody(body, context) {
        /** body will most often be a <w:body> element, but may also be a
         * <w:endnote> or <w:footnote> element. Whichever it is, it will always have
         * <w:p> children.
         *
         * The returned node's .childNodes will be xdom.XParagraph objects.
        */
        var container = new xdom.XNode();
        eachChildElement(body, function (paragraph_element) {
            var node = readParagraph(paragraph_element, context);
            container.appendChild(node);
        });
        return container;
    }
    function readParagraph(paragraph_element, context) {
        /** p should be a DOM Element <w:p> from the original Word document XML.
      
        returns a word.WordContainer, which will have a bunch of WordNode children
        (which can then be joined based on style congruence)
        */
        var paragraph = new xdom.XParagraph();
        context.pushStyles([]);
        // we need to read w:p's children in a loop, because each w:p's is not a constituent
        eachChildElement(paragraph_element, function (child) {
            var tag = dropNS(child.tagName);
            if (tag == 'pPr') {
                var styles = readProperties(child);
                context.setStyles(styles);
            }
            else if (tag == 'r') {
                readRun(child, context).forEach(function (node) {
                    paragraph.appendChild(node);
                });
            }
            else if (tag == 'hyperlink') {
                // hyperlinks are just wrappers around a single w:r that contains a w:t.
                // you can use the w:hyperlink[@r:id] value and _rels/document.xml.rels to resolve it,
                // but for now I just read the raw link
                context.pushStyles(['hyperlink']);
                eachChildElement(child, function (hyperlink_child) {
                    readRun(hyperlink_child, context).forEach(function (node) {
                        paragraph.appendChild(node);
                    });
                });
                context.popStyles();
            }
            else if (tag == 'proofErr') {
            }
            else if (tag == 'bookmarkStart' || tag == 'bookmarkEnd') {
            }
            else {
                log('p > %s ignored', tag);
            }
        });
        context.popStyles();
        return paragraph;
    }
    function readRun(run, context) {
        /** Read the contents of a single w:r element as a list of XNodes
         * context is the mutable state Context object.
        */
        var nodes = [];
        context.pushStyles();
        // an <w:r> will generally contain only one interesting element besides rPr,
        //   e.g., text, footnote reference, endnote reference, or a symbol
        //   but we still iterate through them all; more elegant than multiple find()'s
        eachChildElement(run, function (child) {
            var tag = dropNS(child.tagName);
            if (tag == 'rPr') {
                // presumably, the rPr will occur before anything else (it does in all the docx xml I've come across)
                var styles = readProperties(child);
                context.setStyles(styles);
            }
            else if (tag == 'footnoteReference') {
                var footnote_id = child.getAttribute('w:id');
                // log('r > footnoteReference #%s', footnote_id);
                var footnote_node = context.footnotes[footnote_id];
                nodes.push(footnote_node);
            }
            else if (tag == 'endnoteReference') {
                var endnote_id = child.getAttribute('w:id');
                // log('r > endnoteReference #%s', endnote_id);
                var endnote_node = context.endnotes[endnote_id];
                nodes.push(endnote_node);
            }
            else if (tag == 'sym') {
                var shifted_char_code = child.getAttribute('w:char');
                var font = child.getAttribute('w:font');
                var char_offset = 61440; // = parseInt('F000', 16)
                var char_code = parseInt(shifted_char_code, 16) - char_offset;
                var text = '';
                if (font == 'Symbol' && char_code in characters.symbol) {
                    text = characters.symbol[char_code];
                }
                else if (font == 'Wingdings' && char_code in characters.wingdings) {
                    text = characters.wingdings[char_code];
                }
                else {
                    log('r > sym: %s', shifted_char_code, font);
                    text = shifted_char_code; // symbol_map.get(sym_char)
                }
                // if replacement is None:
                //     logger.critical('Could not find symbol in map: %r' % char)
                //     replacement = u'MISSING SYMBOL (%r)' % char
                var sym_node = new xdom.XSpan(text, context.currentStyles());
                nodes.push(sym_node);
            }
            else if (tag == 't') {
                var t_node = new xdom.XSpan(child.textContent, context.currentStyles());
                nodes.push(t_node);
            }
            else if (tag == 'tab') {
                var tab_node = new xdom.XSpan('\t', context.currentStyles());
                nodes.push(tab_node);
            }
            else if (tag == 'instrText') {
                // hyperlinks look like this:
                // ' HYPERLINK "http://dx.doi.org/10.1018/s11932-003-7165-1" \t "_blank" '
                // references look like this:
                // ' REF _Ref226606793 \r \h '
                // counters look like this:
                // ' LISTNUM  ' or ' LISTNUM Example ' but I think they refer to the same thing
                // I'm not sure what the ' \* MERGEFORMAT ' instructions are for
                log('r > instrText:', child);
                var text = child.textContent;
                var hyperlink_match = text.match(/ HYPERLINK "(.+)" \\t ".+"/);
                if (hyperlink_match) {
                    context.addStyles(['hyperlink', 'url=' + hyperlink_match[1]]);
                }
                var ref_match = text.match(/ REF (.+)/);
                if (ref_match) {
                    var ref = ref_match[1];
                    // prototype = Hyperlink('REF => %s' % ref, r_styles)
                    log('Ignoring REF-type', ref);
                }
                var counter_match = text.match(/ LISTNUM (.*) $/);
                if (counter_match) {
                    context.addStyles(['counter', 'series=' + counter_match[1]]);
                }
            }
            else if (tag == 'fldChar') {
                var field_signal = child.getAttribute('w:fldCharType');
                if (field_signal == 'begin') {
                    log('r > fldChar: fldCharType=begin');
                }
                else if (field_signal == 'separate') {
                    log('r > fldChar: fldCharType=separate');
                }
                else if (field_signal == 'end') {
                    log('r > fldChar: fldCharType=end');
                }
                else {
                    var message = 'r > fldChar: Unrecognized fldCharType: ' + field_signal;
                    throw new Error(message);
                }
            }
            else if (tag == 'separator') {
            }
            else if (tag == 'continuationSeparator') {
            }
            else if (tag == 'footnoteRef') {
            }
            else if (tag == 'endnoteRef') {
            }
            else if (tag == 'lastRenderedPageBreak') {
            }
            else if (tag == 'br') {
                // TODO: should this be a line break of some sort?
                var break_node = new xdom.XSpan('\n', context.currentStyles());
                nodes.push(break_node);
            }
            else {
                log('r > %s ignored', tag); // , child
            }
        });
        context.popStyles();
        return nodes;
    }
    function parseXDocument(arraybuffer) {
        var zip = new JSZip(arraybuffer);
        // footnotes and endnotes are objects keyed by the w:id value (an integer from 0 to 1)
        // to an Array of spans
        var footnotes_doc = parseXML(zip.file('word/footnotes.xml').asText());
        var footnotes = readFootnotes(footnotes_doc);
        var endnotes_doc = parseXML(zip.file('word/endnotes.xml').asText());
        var endnotes = readEndnotes(endnotes_doc);
        var context = new Context(footnotes, endnotes);
        // relationships is a mapping from Id's to Target's
        var relationships_doc = parseXML(zip.file('word/_rels/document.xml.rels').asText());
        var relationships = readRelationships(relationships_doc);
        // metadata is a mapping
        var core_document = parseXML(zip.file('docProps/core.xml').asText());
        var metadata = readMetadata(core_document);
        var doc = new xdom.XDocument([], metadata);
        var main_document = parseXML(zip.file('word/document.xml').asText());
        log('Reading document.xml (%d chars)');
        // the root element of the word/document.xml document is a w:document
        var main_document_root = main_document.documentElement;
        // w:document should have one child element: w:body
        var main_document_body = main_document_root.firstElementChild;
        // body.children is a bunch of <w:p> elements, paragraphs
        _.each(main_document_body.childNodes, function (childNode) {
            var paragraph_node = readParagraph(childNode, context);
            doc.appendChild(paragraph_node);
        });
        return doc;
    }
    exports.parseXDocument = parseXDocument;
});
