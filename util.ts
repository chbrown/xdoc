export const log = console.log.bind(console);

/** from MDN */
export function escapeRegExp(raw: string): string {
  return raw.replace(/([.*+?^=!:${}()|[\]\/\\])/g, '\\$1');
};

/**
Take anything that can be indexed by number and returns a new copied Array of
elements of that type.

Useful for things like NodeLists.
*/
export function list<T>(array: {[index: number]: T}) {
  var result: T[] = [];
  for (var i = 0, item: T; (item = array[i]) !== undefined; i++) {
    result.push(item);
  }
  return result;
}

// pushAll, flatten, and flatMap come from pdfi/Arrays

export function pushAll<T>(array: T[], items: T[]): void {
  return Array.prototype.push.apply(array, items);
}

export function flatten<T>(arrays: T[][]): T[] {
  return Array.prototype.concat.apply([], arrays);
}

export function flatMap<T, R>(elements: T[], callback: (element: T, index: number, array: T[]) => R[], thisArg?: any): R[] {
  const arrays: R[][] = elements.map(callback, thisArg);
  return flatten(arrays);
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
