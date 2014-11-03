define(["require", "exports"], function (require, exports) {
    function El(tagName, attributes, childNodes) {
        if (attributes === void 0) { attributes = {}; }
        if (childNodes === void 0) { childNodes = []; }
        /** Create a new DOM Element with the given tag, attributes, and childNodes.
         If childNodes are not already DOM Node objects, each item in childNodes
         will be stringified and inserted as a text Node.
      
         If childNodes is a NodeList or something other than an Array, this will break.
         */
        // 1. create element
        var el = document.createElement(tagName);
        for (var key in attributes) {
            el.setAttribute(key, attributes[key]);
        }
        // 3. add children
        childNodes.forEach(function (childNode) {
            // 3a. automatically convert plain strings to text nodes
            if (childNode instanceof Node) {
                el.appendChild(childNode);
            }
            else {
                el.appendChild(document.createTextNode(String(childNode)));
            }
        });
        return el;
    }
    exports.El = El;
});
