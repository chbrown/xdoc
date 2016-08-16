// http://en.wikibooks.org/wiki/LaTeX/Special_Characters#Escaped_codes
import {flatMap} from 'tarry';
import {Stack} from 'adts';

import {escapeRegExp, isWhitespace, join} from './util';
import {Style, XNode, XText, XTextContainer, XContainer} from './xdom';

export const replacements = {
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

  '\t': '\\hspace{4em}',
  '⇐': '$\\Leftarrow$',
  '⇔': '$\\Leftrightarrow$',
  '⇒': '$\\Rightarrow$',
  '→': '$\\to$',

  '&': '\\&',
  '—': '---', // m-dash
  '–': '--', // n-dash
  '∞': '$\\infty$', // n-dash
  '☐': '$\\square$',
  '\xa0': '\\ ', // non-breaking space
  // ligatures
  'ﬁ': 'fi',

  '': '\\{',
  '': '|',
  '': '$>$',
  '%': '\\%',

  // ascii symbols (not really a LaTeX issue)
  '==>': '$\\Rightarrow$',
  '||': '\\textbardbl{}',

  // MS Word being so helpful
  '\u200e': '', // U+200E LEFT-TO-RIGHT MARK
};

export const replacementRegExp = new RegExp(Object.keys(replacements).map(escapeRegExp).join('|'), 'g');

const latex_diacritic_commands = {
  // grave is this direction: \
  // acute is this direction: /
  grave: '`',
  acute: "'",
  circumflex: "^",
  tilde: '~',
  umlaut: '"',
  ring: 'r',
  cedilla: 'c',
  hacek: 'v',
  breve: 'u',
  dotover: '.',
  dotunder: 'd',
  bar: 'b',
  macron: '=',
  ogonek: 'k',
};

function applyReplacements(raw: string): string {
  return raw.replace(replacementRegExp, match => replacements[match]);
}

export function t(command: string, content: string): string {
  return `\\${command}{${content}}`;
}

export function e(environment: string, content: string): string {
  return `\\begin{${environment}}
  ${content}
\\end{${environment}}`;
}

export function calculateFlags(x: number): number[] {
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
    case Style.Bold:
      return 'textbf';
    case Style.Italic:
      return 'textit';
    case Style.Underline:
      return 'underline';
    case Style.Subscript:
      return 'textsubscript';
    case Style.Superscript:
      return 'textsuperscript';
    default:
      throw new Error('Invalid style: ' + style);
  }
}

export function stringifyXNodes(nodes: XNode[]): string {
  // first step is to loop through the nodes, grouping contiguous XText nodes into `xTexts_buffer`
  const grouped_nodes: XNode[] = [];
  nodes.forEach(node => {
    if (node instanceof XText) {
      // avoid using a buffer by checking for a current XTextContainer and
      // adding one if needed
      const last_grouped_node = grouped_nodes[grouped_nodes.length - 1];
      let xTextContainer: XTextContainer;
      if (last_grouped_node instanceof XTextContainer) {
        xTextContainer = last_grouped_node;
      }
      else {
        xTextContainer = new XTextContainer();
        grouped_nodes.push(xTextContainer);
      }
      xTextContainer.xTexts.push(node);
    }
    else {
      grouped_nodes.push(node);
    }
  });

  // return this.childNodes.map(childNode => childNode.toLaTeX()).join('');
  return join(grouped_nodes, node => node.toLaTeX(), (left, right) => {
    if (left instanceof XContainer && right instanceof XContainer) {
      return '\n\n';
    }
    return '';
  });
}

class TeXString {
  constructor(private data: string) { }
  toString(): string {
    return applyReplacements(this.data);
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
export function stringifyXTexts(nodes: XText[]): string {
  // split off all hanging whitespace so that we can deal with it separately
  // from the contentful spans
  const queue = flatMap(nodes, xText => {
    const hanging_whitespace_match = xText.data.match(/^(\s+)?([\S\s]*?)(\s+)?$/);
    // hanging_whitespace_match will match anything but the empty string
    const [, left, middle, right] = hanging_whitespace_match;
    // left and/or right might be undefined
    xText.data = middle;
    return [...(left ? [new XText(left)] : []), xText, ...(right ? [new XText(right)] : [])]
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
