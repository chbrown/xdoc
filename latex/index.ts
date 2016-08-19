import {Stack} from 'adts';

import {isWhitespace, join} from '../util';
import * as xdom from '../xdom';

import {applyReplacements} from './characters';

function t(command: string, content: string): string {
  return `\\${command}{${content}}`;
}

function e(environment: string, content: string): string {
  return `\\begin{${environment}}
  ${content}
\\end{${environment}}`;
}

function calculateFlags(x: number): number[] {
  const flags: number[] = [];
  // this could probably be smarter
  for (let power = 0; power < 29; power++) {
    const flag = Math.pow(2, power);
    if (x & flag) {
      flags.push(flag);
    }
  }
  return flags;
}

function getStyleCommand(style: number): string {
  switch (style) {
    case xdom.Style.Bold:
      return 'textbf';
    case xdom.Style.Italic:
      return 'textit';
    case xdom.Style.Underline:
      return 'underline';
    case xdom.Style.Subscript:
      return 'textsubscript';
    case xdom.Style.Superscript:
      return 'textsuperscript';
    default:
      throw new Error(`Invalid style: ${style}`);
  }
}

type XNodeGroup = xdom.XNode | xdom.XText[];

function isXTextGroup(node: XNodeGroup): node is xdom.XText[] {
  return Array.isArray(node);
}

function isXContainer(node: XNodeGroup): node is xdom.XContainer {
  return !isXTextGroup(node) && xdom.isXContainer(node);
}

/**
Word like to prefix its markers (field codes) with _, but gb4e and gb4e-emulate
choke on this due to the automath subscript handling
*/
function cleanMarker(marker: string): string {
  return marker.replace(/[^A-Z0-9-]/gi, '');
}

/**
Loop through the nodes, collecting each sequence of contiguous XText nodes into a XTextGroup.
*/
function groupXNodeList(nodes: xdom.XNode[]): XNodeGroup[] {
  const groups: XNodeGroup[] = [];
  nodes.forEach(node => {
    // we're only concerned with grouping text nodes without line breaks
    if (xdom.isXText(node) && node.data != '\n') {
      // avoid using a buffer by checking for a current XTextContainer
      const lastGroup = groups[groups.length - 1];
      const currentTextGroup = isXTextGroup(lastGroup) ? lastGroup : [];
      // and it to the groups accumulator if it's indeed new
      if (currentTextGroup !== lastGroup) {
        groups.push(currentTextGroup);
      }
      currentTextGroup.push(node);
    }
    else {
      groups.push(node);
    }
  });
  return groups;
}

function renderXContainer(node: xdom.XContainer): string {
  return renderXNodeList(node.children) + node.labels.map(cleanMarker).map(label => t('label', label)).join('');
}

function renderXNodeList(nodes: xdom.XNode[]): string {
  const groups = groupXNodeList(nodes);
  return join(groups, renderXNode, (left, right) => {
    if (isXContainer(left) && isXContainer(right)) {
      return '\n\n';
    }
    return '';
  });
}

export function renderXNode(node: XNodeGroup): string {
  if (isXTextGroup(node)) {
    return renderXTextList(node);
  }
  else if (xdom.isXText(node)) {
    // due to XText grouping, this will only be called on text nodes that
    // contain newlines, which are not candidates for grouping
    return node.data;
  }
  else if (xdom.isXReference(node)) {
    return t('Cref', cleanMarker(node.code));
  }
  else if (xdom.isXExample(node)) {
    return `\\begin{exe}\n  \\ex{${renderXContainer(node)}}\n\\end{exe}`;
  }
  else if (xdom.isXFootnote(node)) {
    // a lot of people like to add space in front of all their footnotes.
    // this is kind of a hack to remove it.
    const contents = renderXContainer(node).replace(/^\s+/, '');
    return t('footnote', contents);
  }
  else if (xdom.isXEndnote(node)) {
    // same preceding-space hack for endnotes
    const contents = renderXContainer(node).replace(/^\s+/, '');
    return t('endnote', contents);
  }
  // lower priority general case:
  else if (xdom.isXContainer(node)) {
    // Handles Section, Subsection, and Subsubsection, among others
    if (node.name == 'paragraph' || node.name == 'document') {
      return renderXContainer(node);
    }
    return t(node.name, renderXNodeList(node.children)) + node.labels.map(cleanMarker).map(label => t('label', label)).join('');
  }
  else {
    // throw new Error('Cannot call .toLaTeX() on abstract class "XNode"');
    throw new Error('Cannot render abstract class "XNode"');
  }
}

class TeXString {
  constructor(private data: string) { }
  toString(): string {
    let tex = applyReplacements(this.data);
    // apply other custom fixes:
    // 1. replace sequences of underscores with a single underlined space
    tex = tex.replace(/_+/g, match => {
      // interpret each underscore as 3pt long
      const pt = match.length * 3;
      return `\\underline{\\hspace{${pt}pt}}`;
    });
    // 2. fix quotes for reasonably-sized strings (up to 200 characters)
    tex = tex.replace(/(^|\(|\[| )'(\S[^']{1,200}\S)'($|\.|,|;|\?|\)|\]| )/g, "$1`$2'$3");
    tex = tex.replace(/(^|\(|\[| )"(\S[^"]{1,200}\S)"($|\.|,|;|\?|\)|\]| )/g, "$1``$2''$3");
    return tex;
  }
}

class TeXNode {
  /**
  Only the root node should have a null `command` value.
  */
  constructor(private command: string, public children: Array<TeXNode | TeXString> = []) { }

  toString(): string {
    let content = this.children.map(child => child.toString()).join('');
    if (this.command !== null) {
      content = t(this.command, content);
    }
    return content;
  }
  push(child: TeXNode | TeXString) {
    this.children.push(child);
  }
}

function findParentTeXNode(parent: TeXNode, searchChild: TeXNode): TeXNode {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child instanceof TeXNode) {
      if (child === searchChild) {
        return parent;
      }
      const found = findParentTeXNode(child, searchChild);
      if (found) {
        return found;
      }
    }
  }
}

/**
Take a list of XText spans, optimize the ordering of the styles, and join all
of the text together into a single string.
*/
function renderXTextList(nodes: xdom.XText[]): string {
  // split off all hanging whitespace so that we can deal with it separately
  // from the contentful spans
  const queue: xdom.XText[] = [];
  nodes.forEach(xText => {
    const m = xText.data.match(/^(\s+)?([\S\s]*?)(\s+)?$/);
    // m[1] (left) and/or m[3] (right) might be undefined
    if (m[1]) {
      queue.push({data: m[1], styles: 0});
    }
    // middle might be the empty string, in which case
    if (m[2]) {
      xText.data = m[2];
      queue.push(xText);
    }
    if (m[3]) {
      queue.push({data: m[3], styles: 0});
    }
  });

  let whitespaceBuffer: string = '';

  // okay, now we need to take this flat list of styled nodes and arrange it into a tree of nested styles
  const tree = new TeXNode(null);
  let treeCursor = tree;
  // treeCursorStyles is a list of nested styles. For example: [1, 3] would be a stack of [bold, bold|italic]
  const treeCursorStyles = new Stack<number>([0]);

  while (queue.length) {
    const xText = queue.shift();
    // only-whitespace always counts as the same style; it's like it has wildcard styles
    if (isWhitespace(xText.data)) {
      whitespaceBuffer += xText.data;
    }
    else {
      // we might need to pop until we can add styles
      // this should never pop past the root node of treeCursorStyles, which will always be 0
      while ((xText.styles & treeCursorStyles.top) !== treeCursorStyles.top) {
        treeCursorStyles.pop();
        treeCursor = findParentTeXNode(tree, treeCursor);
      }

      // okay, we're now at the lowest point we need to be to be able to
      // accommodate the new node by adding styles
      // this lowest point is precisely where we want to insert the whitespace buffer
      if (whitespaceBuffer) {
        treeCursor.push(new TeXString(whitespaceBuffer));
        whitespaceBuffer = '';
      }

      // find the styles to add to get from treeCursorStyles.top to xText.styles
      // (bold=1 ^ bold|italic|underline=7) = italic|underline=6
      const styles_to_add = calculateFlags(xText.styles ^ treeCursorStyles.top);
      styles_to_add.forEach(style => {
        // add a node to the tree
        const command = getStyleCommand(style);
        const child = new TeXNode(command);
        treeCursor.push(child);
        treeCursor = child;
        // update the total styles represented at treeCursor
        treeCursorStyles.push(treeCursorStyles.top | style);
      });
      // okay, cursor now points to the right place
      treeCursor.push(new TeXString(xText.data));
    }
  }

  // final flush
  if (whitespaceBuffer) {
    treeCursor.push(new TeXString(whitespaceBuffer));
    whitespaceBuffer = '';
  }

  // okay, now we serialize the command tree into a single string
  return tree.toString();
}
