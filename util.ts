/** from MDN */
export function escapeRegExp(raw: string): string {
  return raw.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}

export function isWhitespace(data: string): boolean {
  return /^\s+$/.test(data);
}

export function isText(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE;
}
export function isElement(node: Node): node is Element {
  return node.nodeType === Node.ELEMENT_NODE;
}
export function isAttr(node: Node): node is Attr {
  return node.nodeType === Node.ATTRIBUTE_NODE;
}
export function isCDATASection(node: Node): node is CDATASection {
  return node.nodeType === Node.CDATA_SECTION_NODE;
}

/**
Search the codebase for @util.memoize or @memoize for usage examples.
*/
export function memoize<T>(target: Object,
                           propertyKey: string,
                           descriptor: TypedPropertyDescriptor<T>) {
  const get = descriptor.get;
  const memoizedPropertyKey = `_memoized_${propertyKey}`;
  descriptor.get = function() {
    const got = memoizedPropertyKey in this;
    if (!got) {
      this[memoizedPropertyKey] = get.call(this);
    }
    return this[memoizedPropertyKey];
  }
  return descriptor;
}

/**
A fancy variation on Array#join() where you must specify the separator between
each argument via a function that takes pairs of adjacent arguments.
*/
export function join<T>(items: T[],
                        stringFn: (item: T) => string,
                        separatorFn: (left: T, right: T) => string): string {
  const length = items.length;
  // empty arrays require the Math.max(..., 0) below as a special case to avoid
  // trying to create an Array with length -1
  const strings: string[] = new Array(Math.max(length + length - 1, 0));
  for (let i = 0; i < length; i++) {
    strings[i * 2] = stringFn(items[i]);
    if (i + 1 < length) {
      strings[i * 2 + 1] = separatorFn(items[i], items[i + 1]);
    }
  }
  return strings.join('');
}
