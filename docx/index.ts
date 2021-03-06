/**
This module should be used for parsing Microsoft OpenXML documents.

This is the part that needs to worry about the difference between w:p and w:r
*/
import * as JSZip from 'jszip';
import {Stack} from 'adts';
import * as xdom from '../xdom';
import {symbol, wingdings} from './characters';
import {isElement, memoize} from '../util';

interface Map<V> { [index: string]: V }

/**
A Field is delimited by fldChar elements. A Field is usually some kind of
in-document reference that has both a prefix instruction (between the 'begin'
and 'separate' fldCharTypes, indicated as instrText element contents) that
points to some unique variable, and a postfix (specified between the 'separate'
and 'end' fldCharTypes) that indicates the textual content of the field (the
current displayed value).
*/
interface Field {
  /** list of the instructions between the "begin" and the "separate" markers */
  instrTexts: string[];
  /** starts as false and is set to true when fldChar[fldCharType="separate"] is reached. */
  separated: boolean;
  /** container of the nodes between the "separate" and the "end" markers */
  children: xdom.XNode[];
}

class Context {
  fieldStack = new Stack<Field>();
  stylesStack = new Stack<number>();

  /** Combines all styles in the stack */
  currentStyles(): number {
    return this.stylesStack.getElements().reduce((a, b) => a | b, 0);
  }
}

function childElements(node: Node): Element[] {
  return <Element[]>Array.from(node.childNodes)
    .filter(childNode => childNode.nodeType == Node.ELEMENT_NODE);
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
Parse a instrText string sequence.

- hyperlinks look like:
  ' HYPERLINK "http://dx.doi.org/10.1018/s11932-003-7165-1" \t "_blank" '
- list references look like:
  ' REF _Ref226606793 \r \h '
- footnote references look like:
  ' NOTEREF _Ref226606793 \h '
- page references look like:
  ' PAGEREF _Toc297721081 \h '
- counters look like:
  ' LISTNUM  ' or ' LISTNUM Example '
  but I think they refer to the same thing

I'm not sure what the ' \* MERGEFORMAT ' instructions are for
*/
function readInstructionText(text: string): {ref?: string, flags?: string} {
  const hyperlinkMatch = text.match(/ HYPERLINK "(.+)" \\t ".+"/);
  if (hyperlinkMatch) {
    console.warn(`Ignoring r > instrText hyperlink: "${hyperlinkMatch[1]}"`);
    // context.addStyles(['hyperlink', 'url=' + hyperlinkMatch[1]]);
    return {};
  }

  // (list) REF, NOTEREF, and PAGEREF can all be interpreted the same way
  const refMatch = text.match(/^ (REF|NOTEREF|PAGEREF) (\S+) (.+) $/);
  if (refMatch) {
    const [, type, ref, flags] = refMatch;
    return {ref, flags};
  }

  const counterMatch = text.match(/ LISTNUM (.*) $/);
  if (counterMatch) {
    console.info(`Ignoring r > instrText counter: "${counterMatch[1]}"`);
    // context.addStyles(['counter', 'series=' + counterMatch[1]]);
    return {};
  }
  return {};
}

/**
`properties` is an rPr or pPr element

Returns a number representing a bitstring of xdom.Style flags.
*/
function readPropertiesStyles(properties: Element): number {
  let styles = 0;
  // everything we care about will an immediate child of the rPr or pPr
  childElements(properties).forEach(child => {
    const tag = dropNS(child.tagName);
    const val = child.getAttribute('w:val');
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
      // console.warn(`Ignoring ${properties.tagName} > ${child.tagName}[val=${val}]`);
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
  const nodes = Array.from(body.childNodes);
  // TODO: file issue on TypeScript not inferring result of filtering with user-defined type guard function
  const elements = nodes.filter(isElement) as Element[];
  return elements.map(element => readParagraph(element, context, parser));
}

/**
p should be a DOM Element <w:p> from the original Word document XML.

returns a single xdom.XNode, which will have a bunch of XNode children
(which can then be joined based on style congruence)
*/
function readParagraph(paragraph_element: Element, context: Context, parser: Parser): xdom.XContainer {
  let paragraph: xdom.XContainer = {name: 'paragraph', children: [], labels: []};
  context.stylesStack.push(0);

  // we need to read w:p's children in a loop, because each w:p's is not a constituent
  childElements(paragraph_element).forEach(child => {
    const tag = dropNS(child.tagName);

    if (tag == 'pPr') {
      context.stylesStack.top = readPropertiesStyles(child);
      const pStyle = child.querySelector('pStyle');
      if (pStyle) {
        const pStyle_val = pStyle.getAttribute('w:val');
        if (pStyle_val == 'ListNumber' || pStyle_val == 'Example') {
          paragraph = Object.assign(paragraph, {name: 'example'});
        }
        else if (pStyle_val == 'Heading1') {
          paragraph = Object.assign(paragraph, {name: 'section'});
        }
        else if (pStyle_val == 'Heading2') {
          paragraph = Object.assign(paragraph, {name: 'subsection'});
        }
        else if (pStyle_val == 'Heading3') {
          paragraph = Object.assign(paragraph, {name: 'subsubsection'});
        }
        else {
          console.warn('ignoring pPr > pStyle', pStyle_val);
        }
      }
    }
    else if (tag == 'r') {
      // readRun will most often return a list of only one node
      const nodes = readRun(child, context, parser);
      // if we are within a field stack, we append to that rather than the current paragraph
      if (context.fieldStack.top) {
        // by the time we get to text runs inside a field, `context.fieldStack.top.separated` should be true
        context.fieldStack.top.children.push(...nodes);
      }
      else {
        // paragraph = Object.assign(paragraph, {children: [...paragraph.children, ...nodes]});
        paragraph.children.push(...nodes);
      }
    }
    else if (tag == 'hyperlink') {
      // hyperlinks are just wrappers around a single w:r that contains a w:t.
      // you can use the w:hyperlink[@r:id] value and _rels/document.xml.rels to resolve it,
      // but for now I just read the raw link
      // context.pushStyles(['hyperlink']);
      childElements(child).forEach(hyperlink_child => {
        readRun(hyperlink_child, context, parser).forEach(node => {
          // paragraph = Object.assign(paragraph, {children: [...paragraph.children, node]});
          paragraph.children.push(node);
        });
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
      const id = child.getAttribute('w:id');
      const name = child.getAttribute('w:name');

      // for now, I'm just going to assume that labels apply only to the
      // paragraph in which they start, and that they apply to the whole paragraph
      // (this is kind of a hack)
      //console.info('reading bookmark', id, name);

      const code = name;
      paragraph.labels.push(code);
    }
    else if (tag == 'bookmarkEnd') {
      // hopefully bookmarks aren't cross-nested?
    }
    else {
      console.warn(`p > ${tag} ignored`);
    }
  });

  context.stylesStack.pop();

  return paragraph;
}

/**
Read the contents of a single w:r element (`run`) as a list of XNodes

context is the mutable state Context object.
*/
function readRun(run: Element, context: Context, parser: Parser): xdom.XNode[] {
  const nodes: xdom.XNode[] = [];

  context.stylesStack.push(0);
  // an <w:r> will generally (always?) contain only one interesting element besides rPr,
  //   e.g., text, footnote reference, endnote reference, or a symbol
  //   but we still iterate through them all; more elegant than multiple find()'s
  // for (let i = 0, ; i < l; i++) {
  childElements(run).forEach(child => {
    const tag = dropNS(child.tagName);
    if (tag == 'rPr') {
      // presumably, the rPr will occur before anything else (it does in all the docx xml I've come across)
      context.stylesStack.top = readPropertiesStyles(child);
    }
    else if (tag == 'footnoteReference') {
      const footnote_id = child.getAttribute('w:id');
      // console.info(`r > footnoteReference #${footnote_id}`);
      const footnote_node = parser.footnotes[footnote_id];
      nodes.push(footnote_node);
    }
    else if (tag == 'endnoteReference') {
      const endnote_id = child.getAttribute('w:id');
      // console.info(`r > endnoteReference #${endnote_id}`);
      const endnote_node = parser.endnotes[endnote_id];
      nodes.push(endnote_node);
    }
    else if (tag == 'sym') {
      const shifted_char_code = child.getAttribute('w:char');
      const font = child.getAttribute('w:font');
      const char_offset = 61440; // = parseInt('F000', 16)
      const char_code = parseInt(shifted_char_code, 16) - char_offset;

      let text = '';

      if (font == 'Symbol' && char_code in symbol) {
        text = symbol[char_code];
      }
      else if (font == 'Wingdings' && char_code in wingdings) {
        text = wingdings[char_code];
      }
      else {
        console.info(`r > sym: ${shifted_char_code}`, font);
        // console.error(`Could not find symbol in map: ${char}`)
        // replacement = `MISSING SYMBOL (${char})`
        text = shifted_char_code; // symbol_map.get(sym_char)
      }
      nodes.push({data: text, styles: context.currentStyles()});
    }
    else if (tag == 't') {
      nodes.push({data: child.textContent, styles: context.currentStyles()});
    }
    else if (tag == 'tab') {
      nodes.push({data: '\t', styles: context.currentStyles()});
    }
    else if (tag == 'instrText') {
      // <w:instrText> tags are found between <w:fldChar w:fldCharType="begin">
      // and <w:fldChar w:fldCharType="separate" /> elements, but the actual
      // instruction may be split between multiple instrText tags, so we must
      // simply collect it first, and process after.

      // Since we are inside fldChar boundaries, we are guaranteed to have a
      // Field on the context.fieldStack
      const field = context.fieldStack.top;
      if (field) {
        field.instrTexts.push(child.textContent);
      }
      else {
        console.error(`Encountered instrText "${child.textContent}" without available Field while reading run:`, run);
      }
      // console.info('r > instrText:', child);
    }
    else if (tag == 'fldChar') {
      // fldChar indicates a field-delimiter "character".
      const fldCharType = child.getAttribute('w:fldCharType');
      if (fldCharType == 'begin') {
        // console.info('r > fldChar: fldCharType=begin');
        const field: Field = {instrTexts: [], separated: false, children: []};
        context.fieldStack.push(field);
      }
      else if (fldCharType == 'separate') {
        // console.info('r > fldChar: fldCharType=separate');
        context.fieldStack.top.separated = true;
      }
      else if (fldCharType == 'end') {
        // console.info('r > fldChar: fldCharType=end');
        const field = context.fieldStack.pop();
        if (field) {
          const instruction = field.instrTexts.join('');
          const {ref, flags} = readInstructionText(instruction);
          if (ref !== undefined && flags !== undefined) {
            // console.info(`Setting field code to "${ref}" (ignoring flags: ${flags})`);
            const reference: xdom.XReference = {name: 'reference', children: field.children, labels: [], code: ref};
            nodes.push(reference);
          }
          else {
            console.error(`Field instruction "${instruction}" cannot be interpreted as reference`);
          }
        }
        else {
          console.error('Reached field-end without a field on the stack');
        }
        // const change = child.find('{*}numberingChange');
        // let span;
        // if (change) {
        //   let original = change.getAttribute('w:original');
        //   span = new Span(original, S.union([r_styles, p_styles]), p_attrs);
        // }
        // console.info('Found fldCharType=end; reverting p_styles and p_attrs');
      }
      else {
        throw new Error(`r > fldChar: Unrecognized fldCharType: ${fldCharType}`);
      }
    }
    else if (tag == 'br') {
      nodes.push({data: '\n', styles: context.currentStyles()});
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
      console.warn(`r > ${tag} ignored`); // , child
    }
  });
  context.stylesStack.pop();

  if (nodes.length > 1) {
    // console.warn(`readRun returning ${nodes.length} nodes`, nodes);
  }

  return nodes;
}

export class Parser {
  constructor(public zip: JSZip) { }

  get document(): xdom.XDocument {
    // the root element of the word/document.xml document is a w:document, which
    // should have one child element, w:body, whose children are a bunch of
    // <w:p> elements (paragraphs)
    const file = this.zip.file('word/document.xml');
    const documentBody = parseXML(file.asText()).documentElement.firstElementChild;
    const children = childElements(documentBody).map(child => {
      const context = new Context();
      return readParagraph(child, context, this);
    });
    return {name: 'document', metadata: this.metadata, children, labels: []};
  }

  /**
  Read the footnotes for a Word document

  `footnotes` returns a mapping from the footnote's w:id value (an integer
  string), to an XNode-inheriting container of the footnote's contents.
  */
  @memoize
  get footnotes(): Map<xdom.XFootnote> {
    const footnotes: Map<xdom.XFootnote> = {};
    const file = this.zip.file('word/footnotes.xml');
    // The footnotes.xml file may not exist.
    if (file) {
      const document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        const id = child.getAttribute('w:id');
        // each w:footnote has a bunch of w:p children, like a w:body
        const context = new Context();
        const children = readBody(child, context, this);
        footnotes[id] = {name: 'footnote', children, labels: []};
      });
    }
    return footnotes;
  }

  /**
  Read the endnotes for a Word document
  */
  @memoize
  get endnotes(): Map<xdom.XEndnote> {
    const endnotes: Map<xdom.XEndnote> = {};
    const file = this.zip.file('word/endnotes.xml');
    // The endnotes.xml file may not exist.
    if (file) {
      const document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        const id = child.getAttribute('w:id');
        const context = new Context();
        const children = readBody(child, context, this);
        // TODO: why does it compile if I use xdom.XFootnote below?
        endnotes[id] = {name: 'endnote', children, labels: []};
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
    const metadata: Map<string> = {};
    const file = this.zip.file('docProps/core.xml');
    // In case the file does not exist:
    if (file) {
      const document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        const tag = dropNS(child.tagName);
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
          Target="http://dx.doi.org/10.1007/s11049-011-9137-1" TargetMode="External"/>
      </Relationships>

  relationships is a mapping from `Id`s to `Target`s
  */
  @memoize
  get relationships(): Map<string> {
    const relationships: Map<string> = {};
    const file = this.zip.file('word/_rels/document.xml.rels');
    // In case the file does not exist:
    if (file) {
      const document = parseXML(file.asText());
      childElements(document.documentElement).forEach(child => {
        const id = child.getAttribute('Id');
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
  //   const styles: Map<string> = {};
  //   const file = this.zip.file('word/styles.xml');
  //   // In case the file does not exist:
  //   if (file) {
  //     const document = parseXML(file.asText());
  //     eachChildElement(document.documentElement, child => {
  //       const id = child.getAttribute('Id');
  //       relationships[id] = child.getAttribute('Target');
  //     });
  //   }
  //   return styles;
  // }

}
