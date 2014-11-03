/*jslint browser: true */ /*globals angular, _ */

var Types = window;

var raiseObject = function(obj) {
  // Even if obj.__type__ is set, we can't assume that Types has such a key
  var classObj = obj;
  if (obj) {
    var Type = Types[obj.__type__];
    if (Type) {
      if (Type.fromJSON) {
        classObj = Type.fromJSON(obj);
      }
      else {
        // doesn't cut it and is recommended against on SO,
        // despite Javascript being a Prototype-inheritance language:
        // classObj.__proto__ = Type.prototype;
        classObj = new Type(obj);
        // _.extend(classObj, obj);
      }
    }
  }
  return classObj;
};

var raiseJSON = function(obj) {
  if (Array.isArray(obj)) {
    return obj.map(raiseJSON);
  }
  else if (obj === Object(obj)) { // that's how _ does it!
    // mutable!
    for (var key in obj) {
      obj[key] = raiseJSON(obj[key]);
    }
    return raiseObject(obj);
  }
  return obj;
};

// all I need is for ngStorage to use this method instead:
angular.fromJson = function(json) {
  var obj = angular.isString(json) ? JSON.parse(json) : json;
  return raiseJSON(obj);
};
