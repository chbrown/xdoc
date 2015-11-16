/**
This module should be used for parsing Microsoft OpenXML documents.

This is the part that needs to worry about the difference between w:p and w:r
*/
import JSZip = require('jszip');
import {Stack} from 'adts';
import {pushAll, toArray} from 'tarry';
import * as xdom from '../xdom';
import * as characters from '../characters';
import {log, memoize} from '../util';

interface Map<V> { [index: string]: V }

class ComplexField {
  /** `separated` is set to true when w:fldChar[fldCharType="separate"] is reached. */
  separated = false;
  /** `code` is set to the value of a <w:instrText> that contains a 'REF ...' value. */
  code: string;
  /** `childNodes` is a container of the nodes between the "separate" and the "end" markers */
  constructor(public childNodes: xdom.XNode[] = []) { }
}

function childElements(node: Node): Element[] {
  var children = toArray(node.childNodes).filter(childNode => childNode.nodeType == Node.ELEMENT_NODE);
  return <Element[]>children;
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

/**
`properties` is an rPr or pPr element

Returns a number representing a bitstring of xdom.Style flags.
*/
function readPropertiesStyles(properties: Element): number {
  var styles = 0;
  // everything we care about will an immediate child of the rPr or pPr
  childElements(properties).forEach(child => {
    var tag = dropNS(child.tagName);
    var val = child.getAttribute('w:val');
    // italics (and bold, but with w:b) can be
    //   <w:rPr><w:i/></w:rPr> or <w:rPr><w:i w:val='1' /></w:rPr>
    //   but not <w:rPr><w:i w:val='0'/></w:rPr>
    if (tag == 'i' && val != '0') {
      styles |= xdom.Style.Italic;
    }
    else if (tag == 'b' && val != '0') {
      styles |= xdom.Style.Bold;
    }
    else if (tag == 'u' && val == 'single') {
      styles |= xdom.Style.Underline;
    }
    else if (tag == 'vertAlign' && val == 'subscript') {
      styles |= xdom.Style.Subscript;
    }
    else if (tag == 'vertAlign' && val == 'superscript') {
      styles |= xdom.Style.Superscript;
    }
    else if (tag == 'position' && val == '-4') {
      styles |= xdom.Style.Subscript;
    }
    else if (tag == 'position' && val == '6') {
      styles |= xdom.Style.Superscript;
    }
    else {
      // log(`Ignoring ${properties.tagName} > ${child.tagName}[val=${val}]`);
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
function readBody(body: Element, context: Context, parser: Parser): xdom.XContainer[] {
  var childNodes = toArray(body.childNodes)
    .filter(childNode => childNode.nodeType == Node.ELEMENT_NODE)
    .map((element: Element) => readParagraph(element, context, parser));
  return childNodes;
}

/**
p should be a DOM Element <w:p> from the original Word document XML.

returns a single xdom.XNode, which will have a bunch of XNode children
(which can then be joined based on style congruence)
*/
function readParagraph(paragraph_element: Element, context: Context, parser: Parser): xdom.XContainer {
  var paragraph: xdom.XContainer = new xdom.XContainer();
  context.stylesStack.push(0);

  // we need to read w:p's children in a loop, because each w:p's is not a constituent
  childElements(paragraph_element).forEach(child => {
    var tag = dropNS(child.tagName);

    if (tag == 'pPr') {
      context.stylesStack.top = readPropertiesStyles(child);
      var pStyle = child.querySelector('pStyle');
      if (pStyle) {
        var pStyle_val = pStyle.getAttribute('w:val');
        if (pStyle_val == 'ListNumber') {
          paragraph = new xdom.XExample(paragraph.childNodes);
        }
        else if (pStyle_val == 'Heading1') {
          paragraph = new xdom.XSection(paragraph.childNodes);
        }
        else if (pStyle_val == 'Heading2') {
          paragraph = new xdom.XSubsection(paragraph.childNodes);
        }
        else if (pStyle_val == 'Heading3') {
          paragraph = new xdom.XSubsubsection(paragraph.childNodes);
        }
        else {
          log('ignoring pPr > pStyle', pStyle_val);
        }
      }
    }
    else if (tag == 'r') {
      // readRun will most often return a list of only one node
      var nodes = readRun(child, context, parser);
      // if we are within a complex field stack, we append to that rather than the current paragraph
      if (context.complexFieldStack.top) {
        // by the time we get to runs inside a complexField, `context.complexFieldStack.top.separated` should be true
        pushAll(context.complexFieldStack.top.childNodes, nodes);
      }
      else {
        paragraph.appendChildren(nodes);
      }

    }
    else if (tag == 'hyperlink') {
      // hyperlinks are just wrappers around a single w:r that contains a w:t.
      // you can use the w:hyperlink[@r:id] value and _rels/document.xml.rels to resolve it,
      // but for now I just read the raw link
      // context.pushStyles(['hyperlink']);
      childElements(child).forEach(hyperlink_child => {
        readRun(hyperlink_child, context, parser).forEach(node => paragraph.appendChild(node));
      });
      // context.popStyles();
    }
    else if (tag == 'proofErr') {
      // these mark where the squiggly lines go. Why this is part of OpenXML
      // format, I don't know. These have 'w:type' attributes like spellStart,
      // spellEnd, gramStart, and gramEnd
    }
    else if (tag == 'bookmarkStart') {
      /*
      These are strewn about, sometimes in p > &, sometimes everywhere else.

      <w:bookmarkStart w:id="0" w:name="_Ref415460256"></w:bookmarkStart>
      <w:r w:rsidRPr="00B60E9F">
        <w:t>Introduction</w:t>
      </w:r>
      <w:bookmarkEnd w:id="0"></w:bookmarkEnd>
      */
      var id = child.getAttribute('w:id');
      var name = child.getAttribute('w:name');

      // for now, I'm just going to assume that labels apply only to the
      // paragraph in which they start, and that they apply to the whole paragraph
      // (this is kind of a hack)
      //log('reading bookmark', id, name);

      // if (paragraph instanceof xdom.XExample) {
      var code = name.replace(/[^A-Z0-9-]/gi, '');
      paragraph.labels.push(code);
      // }
    }
    else if (tag == 'bookmarkEnd') {
      // hopefully bookmarks aren't cross-nested?
    }
    else {
      log('p > %s ignored', tag);
    }
  });

  context.stylesStack.pop();

  return paragraph;
}

/**
Read the contents of a single w:r element (`run`) as a list of XNodes

context is the mutable state Context object.
*/
function readRun(run: Element, context: Context, parser: Parser): xdom.XNode[] { // xdom.XText | xdom.XFootnote | xdom.XFootnote
  var nodes: xdom.XNode[] = [];

  context.stylesStack.push(0);
  // an <w:r> will generally (always?) contain only one interesting element besides rPr,
  //   e.g., text, footnote reference, endnote reference, or a symbol
  //   but we still iterate through them all; more elegant than multiple find()'s
  // for (var i = 0, ; i < l; i++) {
  childElements(run).forEach(child => {
    var tag = dropNS(child.tagName);
    if (tag == 'rPr') {
      // presumably, the rPr will occur before anything else (it does in all the docx xml I've come across)
      context.stylesStack.top = readPropertiesStyles(child);
    }
    else if (tag == 'footnoteReference') {
      var footnote_id = child.getAttribute('w:id');
      // log('r > footnoteReference #%s', footnote_id);
      var footnote_node = parser.footnotes[footnote_id];
      nodes.push(footnote_node);
    }
    else if (tag == 'endnoteReference') {
      var endnote_id = child.getAttribute('w:id');
      // log('r > endnoteReference #%s', endnote_id);
      var endnote_node = parser.endnotes[endnote_id];
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
        // logger.critical('Could not find symbol in map: %r' % char)
        // replacement = u'MISSING SYMBOL (%r)' % char
        text = shifted_char_code; // symbol_map.get(sym_char)
      }

      var sym_node = new xdom.XText(text, context.currentStyles());
      nodes.push(sym_node);
    }
    else if (tag == 't') {
      var t_node = new xdom.XText(child.textContent, context.currentStyles());
      nodes.push(t_node);
    }
    else if (tag == 'tab') {
      var tab_node = new xdom.XText('\t', context.currentStyles());
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
      // log('r > instrText:', child);

      var text = child.textContent;
      var hyperlink_match = text.match(/ HYPERLINK "(.+)" \\t ".+"/);
      if (hyperlink_match) {
        log('Ignoring r > instrText hyperlink: "%s"', hyperlink_match[1]);
        // context.addStyles(['hyperlink', 'url=' + hyperlink_match[1]]);
      }

      var ref_match = text.match(/^ REF (\S+) (.+) $/);
      if (ref_match) {
        var ref = ref_match[1];
        var flags = ref_match[2];
        // log(`Setting complex field code to "${ref}" (ignoring flags: ${flags})`);
        // `context.complexFieldStateStack.top` should not be undefined, and
        // `context.complexFieldStateStack.top.separated` should be false
        context.complexFieldStack.top.code = ref;
      }

      var counter_match = text.match(/ LISTNUM (.*) $/);
      if (counter_match) {
        log('Ignoring r > instrText counter: "%s"', counter_match[1]);
        // context.addStyles(['counter', 'series=' + counter_match[1]]);
      }
    }
    else if (tag == 'fldChar') {
      // fldChar indicates a field character. The variable is specified between
      // the 'begin' and 'separate' fldCharTypes (usually as instrText), and the
      // current displayed value is specified between the 'separate' and 'end' types.
      var field_signal = child.getAttribute('w:fldCharType');
      if (field_signal == 'begin') {
        // log('r > fldChar: fldCharType=begin');
        context.complexFieldStack.push(new ComplexField());
      }
      else if (field_signal == 'separate') {
        // log('r > fldChar: fldCharType=separate');
        context.complexFieldStack.top.separated = true;
      }
      else if (field_signal == 'end') {
        // log('r > fldChar: fldCharType=end');
        var complexField = context.complexFieldStack.pop();
        if (complexField) {
          var field_node: xdom.XNode = new xdom.XContainer(complexField.childNodes);
          if (complexField.code) {
            var code = complexField.code.replace(/[^A-Z0-9-]/gi, '');
            field_node = new xdom.XReference(code, complexField.childNodes);
          }
          nodes.push(field_node);
        }
        else {
          log(`Empty complexField encountered at:`, child);
        }
        // var change = child.find('{*}numberingChange');
        // var span;
        // if (change) {
        //   var original = change.getAttribute('w:original');
        //   span = new Span(original, S.union([r_styles, p_styles]), p_attrs);
        // }
        // log('Found fldCharType=end; reverting p_styles and p_attrs');
      }
      else {
        throw new Error(`r > fldChar: Unrecognized fldCharType: ${field_signal}`);
      }
    }
    else if (tag == 'br') {
      var break_node = new xdom.XText('\n', context.currentStyles());
      nodes.push(break_node);
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
    else if (tag == 'softHyphen') {
      // um, just ignore for now
    }
    else {
      log('r > %s ignored', tag); // , child
    }
  });
  context.stylesStack.pop();

  if (nodes.length > 1) {
    log('readRun returning %d nodes', nodes.length, nodes);
  }

  return nodes;
}

class Context {
  complexFieldStack = new Stack<ComplexField>();
  stylesStack = new Stack<number>();

  /** Combines all styles in the stack */
  currentStyles(): number {
    return this.stylesStack.getElements().reduce((a, b) => a | b, 0);
  }
}

export class Parser {
  constructor(arraybuffer: ArrayBuffer, public zip = new JSZip(arraybuffer)) { }

  get document() {
    // the root element of the word/document.xml document is a w:document, which
    // should have one child element, w:body, whose children are a bunch of
    // <w:p> elements (paragraphs)
    var file = this.zip.file('word/document.xml');
    var documentBody = parseXML(file.asText()).documentElement.firstElementChild;
    var children = childElements(documentBody).map(child => {
      var context = new Context();
      return readParagraph(child, context, this);
    });
    return new xdom.XDocument(this.metadata, children);
  }

  /**
  Read the footnotes for a Word document

  `footnotes` returns a mapping from the footnote's w:id value (an integer
  string), to an XNode-inheriting container of the footnote's contents.
  */
  @memoize
  get footnotes(): Map<xdom.XFootnote> {
    var footnotes: Map<xdom.XFootnote> = {};
    var file = this.zip.file('word/footnotes.xml');
    // The footnotes.xml file may not exist.
    if (file) {
      var document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        var id = child.getAttribute('w:id');
        // each w:footnote has a bunch of w:p children, like a w:body
        var context = new Context();
        var container_childNodes = readBody(child, context, this);
        footnotes[id] = new xdom.XFootnote(container_childNodes);
      });
    }
    return footnotes;
  }

  /**
  Read the endnotes for a Word document
  */
  @memoize
  get endnotes(): Map<xdom.XEndnote> {
    var endnotes: Map<xdom.XEndnote> = {};
    var file = this.zip.file('word/endnotes.xml');
    // The endnotes.xml file may not exist.
    if (file) {
      var document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        var id = child.getAttribute('w:id');
        var context = new Context();
        var container_childNodes = readBody(child, context, this);
        // TODO: why does it compile if I use xdom.XFootnote below?
        endnotes[id] = new xdom.XEndnote(container_childNodes);
      });
    }
    return endnotes;
  }

  /**
  Turns the simple docProps/core.xml format into a key-value mapping after
  dropping namespaces. core_document should be a DOM Document; returns a plan
  Javascript hash object.

  metadata is a mapping from metadata keys to their string values.
  the keys will be things like 'title', 'creator', 'keywords', 'revision',
  along with several other dates / names
  */
  @memoize
  get metadata(): Map<string> {
    var metadata: Map<string> = {};
    var file = this.zip.file('docProps/core.xml');
    // In case the file does not exist:
    if (file) {
      var document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        var tag = dropNS(child.tagName);
        metadata[tag] = child.textContent;
      });
    }
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

  relationships is a mapping from `Id`s to `Target`s
  */
  @memoize
  get relationships(): Map<string> {
    var relationships: Map<string> = {};
    var file = this.zip.file('word/_rels/document.xml.rels');
    // In case the file does not exist:
    if (file) {
      var document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        var id = child.getAttribute('Id');
        relationships[id] = child.getAttribute('Target');
      });
    }
    return relationships;
  }

  /**
  The word/styles.xml looks like:


      <w:styles xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14">

        <w:style w:type="paragraph" w:styleid="ListNumber">
          <w:name w:val="List Number"></w:name>
          <w:basedOn w:val="Normal"></w:basedOn>
          <w:uiPriority w:val="99"></w:uiPriority>
          <w:unhideWhenUsed></w:unhideWhenUsed>
          <w:rsid w:val="000E4623"></w:rsid>
          <w:pPr>
            <w:numPr><w:numId w:val="16"></w:numId></w:numPr>
            <w:spacing w:before="120" w:after="120"></w:spacing>
            <w:ind w:left="720"></w:ind>
            <w:contextualSpacing></w:contextualSpacing>
          </w:pPr>
          <w:rPr>
            <w:rFonts w:ascii="Times New Roman" w:hansi="Times New Roman"></w:rFonts>
            <w:color w:val="auto"></w:color>
            <w:sz w:val="24"></w:sz>
          </w:rPr>
        </w:style>
      </w:styles>
  */
  // @memoize
  // styles(): Map<string> {
  //   var styles: Map<string> = {};
  //   var file = this.zip.file('word/styles.xml');
  //   // In case the file does not exist:
  //   if (file) {
  //     var document = parseXML(file.asText());
  //     eachChildElement(document.documentElement, child => {
  //       var id = child.getAttribute('Id');
  //       relationships[id] = child.getAttribute('Target');
  //     });
  //   }
  //   return styles;
  // }

}
