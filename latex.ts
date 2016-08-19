// http://en.wikibooks.org/wiki/LaTeX/Special_Characters#Escaped_codes
import {Stack} from 'adts';

import {escapeRegExp, isWhitespace, join} from './util';
import * as xdom from './xdom';

const replacements = {
  // these need to be first!
  '\\': '\\backslash{}',
  '{': '\\{',
  '}': '\\}',
  '$': '\\$',
  '#': '\\#',

  // acute
  'á': "\\'a",
  'é': "\\'e",
  'í': "\\'i",
  'ó': "\\'o",
  'ú': "\\'u",
  // double acute
  'ő': '\\H{o}',
  'ű': '\\H{u}',
  // grave
  'ò': '\\`{o}',
  // umlaut
  'ö': '\\"o',
  'ü': '\\"u',
  // circumflex
  'ô': '\\^{o}',
  // breve
  'ŏ': '\\u{o}',
  // caron / hacek (little v)
  'č': '\\v{c}',
  // combining accents
  '̈': '\\"', // diaeresis
  '́': "\\'", // acute

  'ø': '\\o',
  'Ø': '\\O',

  '∧': '$\\wedge$',
  '∨': '$\\vee$',
  '∀': '$\\forall$',
  '': '$\\forall$',
  '∃': '$\\exists$',
  '': '$\\exists$',

  '¬': '$\\neg$',
  '≠': '$\\neq$',
  '≤': '$\\leq$',
  '': '$<$',
  '<': '\\textless{}',
  '>': '\\textgreater{}',

  '∈': '$\\in$',
  '': '$\\in$',
  '∅': '$\\emptyset$',
  '': '$\\cap$',
  '−': '$-$', // 'MINUS SIGN' (U+2212)
  '⊑': '$\\sqsubseteq$', // 'SQUARE IMAGE OF OR EQUAL TO' (U+2291)
  '⊃': '$\\supset$',
  '⊂': '$\\subset$',
  '≡': '$\\equiv$',
  '⊆': '$\\subseteq$', // U+2286 SUBSET OF OR EQUAL TO
  '⊇': '$\\supseteq$',
  '≥': '$\\ge$',
  '×': '$\\times$',
  '∪': '$\\cup$',

  '‘': '`',
  '’': "'",
  '“': '``',
  '”': "''",

  '…': '\\dots{}',

  // greek alphabet
  'α': '$\\alpha$',
  '': '$\\alpha$',
  'λ': '$\\lambda$',
  '': '$\\lambda$',
  'δ': '$\\delta$',
  'ε': '$\\epsilon$',
  'ι': '$\\iota$',
  'Π': '$\\Pi$',
  'π': '$\\pi$',
  'ϕ': '$\\phi$',
  '': '$\\phi$',
  'θ': '$\\theta$',
  'Θ': '$\\Theta$',
  'β': '$\\beta$',
  '': '$\\beta$',
  '': ' ',
  '': '$\\pi$',
  '': ',',
  'µ': '$\\mu$',
  'μ': '$\\mu$',
  'τ': '$\\tau$',

  '◊': '$\\lozenge$',

  '\t': '\\tab{}',
  '⇐': '$\\Leftarrow$',
  '⇔': '$\\Leftrightarrow$',
  '⇒': '$\\Rightarrow$',
  '→': '$\\to$',

  '&': '\\&',
  '—': '---', // m-dash
  '–': '--', // n-dash
  '∞': '$\\infty$', // n-dash
  '☐': '$\\square$',
  '\xa0': '~', // non-breaking space
  // ligatures
  'ﬁ': 'fi',

  '': '\\{',
  '': '|',
  '': '$>$',
  '%': '\\%',

  // ascii symbols (not really a LaTeX issue)
  '==>': '$\\Rightarrow$',
  '=>': '$\\Rightarrow$',
  '||': '\\textbardbl{}',

  // MS Word being so helpful
  '\u200e': '', // U+200E LEFT-TO-RIGHT MARK
};

const replacementRegExp = new RegExp(Object.keys(replacements).map(escapeRegExp).join('|'), 'g');

function applyReplacements(raw: string): string {
  return raw.replace(replacementRegExp, match => replacements[match]);
}

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

function groupXNodeList(nodes: xdom.XNode[]): xdom.XNode[] {
  // loop through the nodes, grouping contiguous XText nodes into `xTextContainer`
  const groups: xdom.XNode[] = [];
  nodes.forEach(node => {
    if (node instanceof xdom.XText) {
      // avoid using a buffer by checking for a current XTextContainer and
      // adding one if needed
      const lastGroup = groups[groups.length - 1];
      let xTextContainer: XTextContainer;
      if (lastGroup instanceof XTextContainer) {
        xTextContainer = lastGroup;
      }
      else {
        xTextContainer = new XTextContainer();
        groups.push(xTextContainer);
      }
      xTextContainer.xTexts.push(node);
    }
    else {
      groups.push(node);
    }
  });
  return groups;
}

class XTextContainer extends xdom.XNode {
  constructor(public xTexts: xdom.XText[] = []) { super() }
}

function renderXContainer(node: xdom.XContainer): string {
  return renderXNodeList(node.childNodes) + node.labels.map(label => t('label', label)).join('');
}

function renderXNodeList(nodes: xdom.XNode[]): string {
  const groups = groupXNodeList(nodes);
  return join(groups, renderXNode, (left, right) => {
    if (left instanceof xdom.XContainer && right instanceof xdom.XContainer) {
      return '\n\n';
    }
    return '';
  });
}

export function renderXNode(node: xdom.XNode): string {
  if (xdom.isXText(node)) {
    // normally, this won't be called
    console.warn('Unusual call to renderXNode with XText node');
    return node.data;
  }
  else if (xdom.isXReference(node)) {
    return t('Cref', node.code);
  }
  else if (node instanceof XTextContainer) {
    return renderXTextList(node.xTexts);
  }
  else if (xdom.isXNamedContainer(node)) {
    // Handles Section, Subsection, and Subsubsection, among others
    return t(node.name, renderXNodeList(node.childNodes)) + node.labels.map(label => t('label', label)).join('');
  }
  else if (xdom.isXExample(node)) {
    return `\\begin{exe}\n  \\ex ${renderXContainer(node)}\n\\end{exe}`;
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
    return renderXContainer(node);
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
      queue.push(new xdom.XText(m[1]));
    }
    // middle might be the empty string, in which case
    if (m[2]) {
      xText.data = m[2];
      queue.push(xText);
    }
    if (m[3]) {
      queue.push(new xdom.XText(m[3]));
    }
  });

  let whitespace_buffer: string = '';

  // okay, now we need to take this flat list of styled nodes and arrange it into a tree of nested styles
  const tree = new TeXNode(null);
  let treeCursor = tree;
  // treeCursorStyles is a list of nested styles. For example: [1, 3] would be a stack of [bold, bold|italic]
  const treeCursorStyles = new Stack<number>([0]);

  while (queue.length) {
    const xText = queue.shift();
    // only-whitespace always counts as the same style; it's like it has wildcard styles
    if (isWhitespace(xText.data)) {
      whitespace_buffer += xText.data;
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
      if (whitespace_buffer) {
        treeCursor.push(new TeXString(whitespace_buffer));
        whitespace_buffer = '';
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
  if (whitespace_buffer) {
    treeCursor.push(new TeXString(whitespace_buffer));
    whitespace_buffer = '';
  }

  // okay, now we serialize the command tree into a single string
  return tree.toString();
}
