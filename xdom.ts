/** We can do bitwise math in Javascript up to 2^29, so we can have up to
29 styles.
    2 << 29 ==  1073741824 == 2^30
    2 << 30 == -2147483648 != 2^31
But maybe it isn't the best design for Style to be an Enum?
Think of the colors!
*/
export enum Style {
  Bold = 1,
  Italic = 2,
  Underline = 4,
  Subscript = 8,
  Superscript = 16,
}

/**
When XText#styles == null that signifies wildcard styles, usually used for whitespace.
*/
export interface XText {
  data: string;
  styles: number;
}

/**
Output is similar to XNode's, but returns an actual HTML DOM element,
a div.paragraph, rather than a document fragment.

Paragraphs can only have XElements (and subclasses) as children, never naked
XOldText nodes.

Generally, the 'name' of an XNamedContainer will be a LaTeX command, like
'section' or 'footnote'.
*/
export interface XContainer {
  name: string;
  children: XNode[];
  labels: string[];
}

// plain XContainer sub-types
export interface XSection extends XContainer {
  name: 'section';
}
export interface XSubsection extends XContainer {
  name: 'subsection';
}
export interface XSubsubsection extends XContainer {
  name: 'subsubsection';
}
export interface XExample extends XContainer {
  name: 'example';
}
export interface XFootnote extends XContainer {
  name: 'footnote';
}
export interface XEndnote extends XContainer {
  name: 'endnote';
}

// XContainer sub-types with extra fields
export interface XReference extends XContainer {
  name: 'reference';
  code: string;
}
export interface XDocument extends XContainer {
  name: 'document';
  metadata: { [index: string]: string };
}

/**
A fragment of a Document model; can be either a container,
or, when extended, a node with some semantic role in a document.
*/
export type XNode = XText
                  | XContainer
                  | XSection
                  | XSubsection
                  | XSubsubsection
                  | XExample
                  | XFootnote
                  | XEndnote
                  | XReference
                  | XDocument;

export function isXText(node: XNode): node is XText {
  return 'data' in node;
}

export function isXContainer(node: XNode): node is XContainer {
  return 'children' in node;
}
export function isXExample(node: XNode): node is XExample {
  return isXContainer(node) && node.name == 'example';
}
export function isXFootnote(node: XNode): node is XFootnote {
  return isXContainer(node) && node.name == 'footnote';
}
export function isXEndnote(node: XNode): node is XEndnote {
  return isXContainer(node) && node.name == 'endnote';
}

export function isXReference(node: XNode): node is XReference {
  return isXContainer(node) && node.name == 'reference';
}
export function isXDocument(node: XNode): node is XDocument {
  return isXContainer(node) && node.name == 'document';
}
