/*jslint browser: true */ /*globals module, inherits */

export class Set {
  /**
   S = Set: a helper around an object with keys that represent elements in the set.
   The values of the object are all true; they do not really matter.
   This object is available at the private member `._element_object`.

   S(), S([]), new S(), and new S([]) will all return the empty set.

   */
  private _element_object: {[index: string]: boolean};
  constructor(elements: Array<string> = []) {
    this._element_object = {};
    for (var i = 0, element; (element = elements[i]); i++) {
      this._element_object[element] = true;
    }
  }
  // handle overloading constructor without `new` keyword
  //(elements: Array<string>): Set {
  //  return new Set(elements);
  //}
  //if (!(this instanceof Set)) {
  //  return new Set(elements);
  //}
  //if (elements instanceof Set) {
  //  // creating a new S from another S will create a copy
  //  elements = elements.toArray();
  //}
  _add(element: string) {
    /** Mutable. */
    this._element_object[element] = true;
  }
  add(element: string) {
    /** Immutable. Returns a new set. */
    var s = new Set([element]);
    s._merge(this);
    return s;
  }
  _merge(other_set: Set) {
    /** Mutable. */
    for (var element in other_set._element_object) {
      this._element_object[element] = true;
    }
  }
  _remove(element: string) {
    /** Mutable. No-op if the element doesn't exist anyway. */
    delete this._element_object[element];
  }
  equal(other_set: Set) {
    /** Pairwise set comparison. Return false at the first mismatch.

     S([1, 4, 9]).equal(S([9, 4, 1])) == true
     S(['a', 'b', 'z']).equal(S(['a', 'b'])) == false

     TODO: avoid overlapping comparisons?
     */
    for (var other_element in other_set._element_object) {
      if (!this._element_object[other_element]) {
        return false;
      }
    }
    for (var this_element in this._element_object) {
      if (!other_set._element_object[this_element]) {
        return false;
      }
    }
    return false;
  }
  contains(element) {
    return element in this._element_object;
  }
  toArray() {
    /** returns Array (of strings, usually) */
    return Object.keys(this._element_object);
  }

  //static intersect(sets: Array<Set>) {
  //  var s = new Set();
  //  sets.forEach(function(set) {
  //    s._merge(set);
  //  });
  //  return s;
  //}
  //static subtract(sets) {
  //}
  static union(sets: Array<Set>) {
    /** Immutable. Returns a new set that contains all the elements from the
     given sets (may be the empty set). */
    var s = new Set();
    // sets.forEach(s._merge.bind(s));
    sets.forEach(function(set) {
      s._merge(set);
    });
    return s;
  }
  static equal(sets: Array<Set>) {
    /** Compare an Array of sets, return true if they're all equal.
     */
    if (sets.length < 2) return true;
    // much like the instance.equal version, return on the first mismatch
    var prototype_set = sets[0];
    // use a for loop to allow immediate return
    for (var i = 1, other_set; (other_set = sets[i]); i++) {
      if (!prototype_set.equal(other_set)) {
        return false;
      }
    }
    return true;
  }
}


export class Bag {
  /**
  Bag: a multiset; i.e., a Set with counts. The underlying datatype
  is a object, `._element_object`. The effective default of members
  of `._element_object` is 0. Being undefined, having a value of undefined,
  null, false, etc., is all equivalent to having a 0 count.

  `Bag()` and `new Bag()` both return an empty bag.
  */
  // handle overloading constructor without `new` keyword
  //if (!(this instanceof Bag)) {
  //  return new Bag(counts);
  //}

  //if (counts instanceof Bag) {
  //  return counts.clone();
  //}
  //else if (elements instanceof Set) {
  //  // creating a new S from another S will create a copy
  //  elements = elements.toArray();
  //}
  private _element_object: {[index: string]: number};
  constructor(elements: Array<string> = []) {
    this._element_object = {};
    for (var i = 0, element; (element = elements[i]); i++) {
      this._element_object[element] = 1;
    }
  }

  //countOf(element) {
  //  /**
  //   * Return the number of times `element` shows up in this Bag, a.k.a., the
  //   * multiplicity of `element` */
  //  //return this._element_object[element];
  //}
  //_add(elements) {
  //  /** */
  //  //return this._element_object[element];
  //}
  //
  //static fromSet(element) {
  //  /** Return the number of times `element` shows up in this Bag, a.k.a., the
  //   multiplicity of `element` */
  //  //return this._element_object[element];
  //}
}

// alias S to sets.Set
//window.S = window.sets.Set;
