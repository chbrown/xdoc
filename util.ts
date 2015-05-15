export const log = console.log.bind(console);

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
