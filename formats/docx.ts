/// <reference path="../type_declarations/index.d.ts" />

/**
This module should be used for parsing Microsoft OpenXML documents.

This is the part that needs to worry about the difference between w:p and w:r
*/

import JSZip = require('jszip');
import adts = require('adts');
import xdom = require('../xdom');
import characters = require('../characters');
import {log} from '../util';

function eachChildElement(node: Node, func: (element: Element) => void) {
  for (var i = 0, childNode: Node; (childNode = node.childNodes[i]); i++) {
    if (childNode.nodeType == Node.ELEMENT_NODE) {
      var element = <Element>childNode;
      func(element);
    }
  }
}

class Context {
  constructor(public footnotes: Map<xdom.XFootnote> = {},
              public endnotes: Map<xdom.XEndnote> = {},
              public style_stack: adts.Set[] = [new adts.Set()]) { }
  pushStyles(styles: string[] = []): void {
    this.style_stack.push(new adts.Set(styles));
  }
  popStyles() {
    return this.style_stack.pop();
  }
  setStyles(styles: adts.Set): void {
    this.style_stack[this.style_stack.length - 1] = styles;
  }
  addStyles(styles: string[]): void {
    var top = this.style_stack[this.style_stack.length - 1];
    this.setStyles(adts.Set.union([top, new adts.Set(styles)]));
  }
  currentStyles() {
    /** Returns set (as instance of S) */
    return adts.Set.union(this.style_stack);
  }
}

/**
parseXML takes an XML string and returns a DOM Level 2/3 Document:
https://developer.mozilla.org/en-US/docs/Web/API/document
Uses the XML mode of the built-in DOMParser:
https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
*/
function parseXML(xml: string): Document {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

/**
Drop the namespace part of a fully qualified name, e.g.:

    dropNS('w:r') -> 'r'
    dropNS('br') -> 'br'
*/
function dropNS(qualifiedName: string) {
  return qualifiedName.replace(/^.+:/, '');
}

/** Read the footnotes for a DocX document */
function readFootnotes(document: Document): Map<xdom.XFootnote> {
  var notes: Map<xdom.XFootnote> = {};
  document.documentElement
  eachChildElement(document.documentElement, note => {
    var id = note.getAttribute('w:id');
    // each w:footnote has a bunch of w:p children, like a w:body
    var context = new Context();
    var container = readBody(note, context);
    notes[id] = new xdom.XFootnote(container.childNodes);
  });
  return notes;
}

/** Read the endnotes for a DocX document */
function readEndnotes(document: Document): Map<xdom.XEndnote> {
  var notes: Map<xdom.XEndnote> = {};
  eachChildElement(document.documentElement, note => {
    var id = note.getAttribute('w:id');
    // each w:endnote has a bunch of w:p children, like a w:body
    var context = new Context();
    var container = readBody(note, context);
    notes[id] = new xdom.XEndnote(container.childNodes);
  });
  return notes;
}

/**
Turns the simple docProps/core.xml format into a key-value mapping after
dropping namespaces. core_document should be a DOM Document; returns a plan
Javascript hash object.
*/
function readMetadata(core_document: Document): Map<string> {
  var metadata: Map<string> = {};
  eachChildElement(core_document.documentElement, child => {
    var tag = dropNS(child.tagName);
    metadata[tag] = child.textContent;
  });
  return metadata;
}

/**
The word/_rels/document.xml.rels looks kind of like:

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
function readRelationships(relationships_document: Document): Map<string> {
  var relationships: Map<string> = {};
  eachChildElement(relationships_document.documentElement, child => {
    var id = child.getAttribute('Id');
    relationships[id] = child.getAttribute('Target');
  });
  return relationships;
}

/**
`properties` is an rPr or pPr element

Returns a set of style strings (like "bold" or "italic"), as an instance of
S (from sets.js)
*/
function readProperties(properties: Element): adts.Set {
  var styles = new adts.Set();
  // everything we care about will an immediate child of the rPr or pPr
  eachChildElement(properties, child => {
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
      // log('Ignoring %s > %s', dropNS(properties_element.tagName), tag); // , child
    }
  });

  return styles;
}

// readBody, readParagraph, and readRun all use and potentially manipulate the current context

/**
body will most often be a <w:body> element, but may also be a
<w:endnote> or <w:footnote> element. Whichever it is, it will always have
<w:p> children.

The returned node's .childNodes will be xdom.XParagraph objects.
*/
function readBody(body: Element, context: Context): xdom.XNode {
  var container = new xdom.XNode();
  eachChildElement(body, paragraph_element => {
    var node = readParagraph(paragraph_element, context);
    container.appendChild(node);
  });
  return container;
}

function readParagraph(paragraph_element: Element, context: Context): xdom.XNode {
  /** p should be a DOM Element <w:p> from the original Word document XML.

  returns a word.WordContainer, which will have a bunch of WordNode children
  (which can then be joined based on style congruence)
  */
  var paragraph = new xdom.XParagraph();
  context.pushStyles([]);

  // we need to read w:p's children in a loop, because each w:p's is not a constituent
  eachChildElement(paragraph_element, child => {
    var tag = dropNS(child.tagName);

    if (tag == 'pPr') {
      var styles = readProperties(child);
      context.setStyles(styles);
    }
    else if (tag == 'r') {
      readRun(child, context).forEach(node => paragraph.appendChild(node));
    }
    else if (tag == 'hyperlink') {
      // hyperlinks are just wrappers around a single w:r that contains a w:t.
      // you can use the w:hyperlink[@r:id] value and _rels/document.xml.rels to resolve it,
      // but for now I just read the raw link
      context.pushStyles(['hyperlink']);
      eachChildElement(child, hyperlink_child => {
        readRun(hyperlink_child, context).forEach(node => paragraph.appendChild(node));
      });
      context.popStyles();
    }
    else if (tag == 'proofErr') {
      // these mark where the squiggly lines go. Why this is part of OpenXML
      // format, I don't know. These have 'w:type' attributes like spellStart,
      // spellEnd, gramStart, and gramEnd
    }
    else if (tag == 'bookmarkStart' || tag == 'bookmarkEnd') {
      // these are strewn about, sometimes in p > &, sometimes everywhere else.
    }
    else {
      log('p > %s ignored', tag);
    }
  });

  context.popStyles();

  return paragraph;
}

function readRun(run: Element, context: Context): xdom.XNode[] {
  /** Read the contents of a single w:r element as a list of XNodes
  context is the mutable state Context object.
  */
  var nodes = [];

  context.pushStyles();
  // an <w:r> will generally contain only one interesting element besides rPr,
  //   e.g., text, footnote reference, endnote reference, or a symbol
  //   but we still iterate through them all; more elegant than multiple find()'s
  eachChildElement(run, child => {
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
        // var change = child.find('{*}numberingChange');
        // var span;
        // if (change) {
        //   var original = change.getAttribute('w:original');
        //   span = new Span(original, S.union([r_styles, p_styles]), p_attrs);
        // }
        // log('Found fldCharType=end; reverting p_styles and p_attrs');
      }
      else {
        var message = 'r > fldChar: Unrecognized fldCharType: ' + field_signal;
        throw new Error(message );
      }
    }
    else if (tag == 'separator') {
      // this denotes the horizontal line in footnotes
      // http://msdn.microsoft.com/en-us/library/documentformat.openxml.wordprocessing.separatormark(v=office.14).aspx
    }
    else if (tag == 'continuationSeparator') {
      // this denotes a full-width horizontal line in footnotes
      // http://msdn.microsoft.com/en-us/library/documentformat.openxml.wordprocessing.continuationseparatormark(v=office.14).aspx
    }
    else if (tag == 'footnoteRef') {
      // OpenXML explicitly marks where the footnote number goes (in a footnote) with this empty element
    }
    else if (tag == 'endnoteRef') {
      // OpenXML explicitly marks where the endnote marker goes with this empty element
    }
    else if (tag == 'lastRenderedPageBreak') {
      // should this equate to some kind of page break? I don't think so.
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

export function parseXDocument(arraybuffer: ArrayBuffer): xdom.XDocument {
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
  log('Reading document.xml');

  // the root element of the word/document.xml document is a w:document
  var main_document_root = main_document.documentElement;
  // w:document should have one child element: w:body
  var main_document_body = main_document_root.firstElementChild;
  // body.children is a bunch of <w:p> elements, paragraphs
  eachChildElement(main_document_body, childNode => {
    var paragraph_node = readParagraph(childNode, context);
    doc.appendChild(paragraph_node);
  });

  return doc;
}
