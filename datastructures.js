/*jslint browser: true */ /*globals module, inherits */
define(["require", "exports"], function (require, exports) {
    var Set = (function () {
        function Set(elements) {
            if (elements === void 0) { elements = []; }
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
        Set.prototype._add = function (element) {
            /** Mutable. */
            this._element_object[element] = true;
        };
        Set.prototype.add = function (element) {
            /** Immutable. Returns a new set. */
            var s = new Set([element]);
            s._merge(this);
            return s;
        };
        Set.prototype._merge = function (other_set) {
            for (var element in other_set._element_object) {
                this._element_object[element] = true;
            }
        };
        Set.prototype._remove = function (element) {
            /** Mutable. No-op if the element doesn't exist anyway. */
            delete this._element_object[element];
        };
        Set.prototype.equal = function (other_set) {
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
        };
        Set.prototype.contains = function (element) {
            return element in this._element_object;
        };
        Set.prototype.toArray = function () {
            /** returns Array (of strings, usually) */
            return Object.keys(this._element_object);
        };
        //static intersect(sets: Array<Set>) {
        //  var s = new Set();
        //  sets.forEach(function(set) {
        //    s._merge(set);
        //  });
        //  return s;
        //}
        //static subtract(sets) {
        //}
        Set.union = function (sets) {
            /** Immutable. Returns a new set that contains all the elements from the
             given sets (may be the empty set). */
            var s = new Set();
            // sets.forEach(s._merge.bind(s));
            sets.forEach(function (set) {
                s._merge(set);
            });
            return s;
        };
        Set.equal = function (sets) {
            /** Compare an Array of sets, return true if they're all equal.
             */
            if (sets.length < 2)
                return true;
            // much like the instance.equal version, return on the first mismatch
            var prototype_set = sets[0];
            for (var i = 1, other_set; (other_set = sets[i]); i++) {
                if (!prototype_set.equal(other_set)) {
                    return false;
                }
            }
            return true;
        };
        return Set;
    })();
    exports.Set = Set;
    var Bag = (function () {
        function Bag(elements) {
            if (elements === void 0) { elements = []; }
            this._element_object = {};
            for (var i = 0, element; (element = elements[i]); i++) {
                this._element_object[element] = 1;
            }
        }
        return Bag;
    })();
    exports.Bag = Bag;
});
