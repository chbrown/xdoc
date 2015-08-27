export const log = console.log.bind(console);

/** from MDN */
export function escapeRegExp(raw: string): string {
  return raw.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
}

export function isWhitespace(data: string): boolean {
  return /^\s+$/.test(data);
}

/**
Search the codebase for @util.memoize or @memoize for usage examples.
*/
export function memoize<T>(target: Object,
                           propertyKey: string,
                           descriptor: TypedPropertyDescriptor<T>) {
  var get = descriptor.get;
  var memoizedPropertyKey = `_memoized_${propertyKey}`;
  descriptor.get = function() {
    var got = memoizedPropertyKey in this;
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
  var length = items.length;
  // empty arrays require the Math.min(..., 0) below as a special case to avoid
  // trying to create an Array with length -1
  var strings: string[] = new Array(Math.max(length + length - 1, 0));
  for (var i = 0; i < length; i++) {
    strings[i * 2] = stringFn(items[i]);
    if (i + 1 < length) {
      strings[i * 2 + 1] = separatorFn(items[i], items[i + 1]);
    }
  }
  return strings.join('');
}
