import {escapeRegExp} from '../util';

// http://en.wikibooks.org/wiki/LaTeX/Special_Characters#Escaped_codes
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

export function applyReplacements(raw: string): string {
  return raw.replace(replacementRegExp, match => replacements[match]);
}
