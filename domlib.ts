export function El(tagName: string,
                   attributes: {[index: string]: string} = {},
                   childNodes: Array<any> = []) {
  /** Create a new DOM Element with the given tag, attributes, and childNodes.
   If childNodes are not already DOM Node objects, each item in childNodes
   will be stringified and inserted as a text Node.

   If childNodes is a NodeList or something other than an Array, this will break.
   */
  // 1. create element
  var el = document.createElement(tagName);
  // 2. set attributes
  for (var key in attributes) {
    el.setAttribute(key, attributes[key]);
  }
  // 3. add children
  childNodes.forEach(function(childNode) {
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
