var base64_chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// function encodeArrayBuffer(arraybuffer) {
//   var array = new Uint8Array(arraybuffer);
//   return String.fromCharCode.apply(null, array);
// }
export function encodeArrayBuffer(arraybuffer) {
  /** Converts an ArrayBuffer directly to base64, without any intermediate
      'convert to string then use window.btoa' step. According to my tests,
      this appears to be a faster approach: http://jsperf.com/encoding-xhr-image-data/5

      https://gist.github.com/jonleighton/958841
  */
  var base64    = '';

  var bytes         = new Uint8Array(arraybuffer);
  var byteLength    = bytes.byteLength;
  var byteRemainder = byteLength % 3;
  var mainLength    = byteLength - byteRemainder;

  var a, b, c, d;
  var chunk;

  // Main loop deals with bytes in chunks of 3
  for (var i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048)   >> 12; // 258048   = (2^6 - 1) << 12
    c = (chunk & 4032)     >>  6; // 4032     = (2^6 - 1) << 6
    d = chunk & 63;               // 63       = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += base64_chars[a] + base64_chars[b] + base64_chars[c] + base64_chars[d];
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder == 1) {
    chunk = bytes[mainLength];

    a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3)   << 4; // 3   = 2^2 - 1

    base64 += base64_chars[a] + base64_chars[b] + '==';
  } else if (byteRemainder == 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

    a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008)  >>  4; // 1008  = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15)    <<  2; // 15    = 2^4 - 1

    base64 += base64_chars[a] + base64_chars[b] + base64_chars[c] + '=';
  }

  return base64;
}

// function decodeArrayBuffer(raw) {
//   var buffer = new ArrayBuffer(raw.length);
//   var array = new Uint8Array(buffer);
//   for (var i = 0, l = raw.length; i < l; i++) {
//     array[i] = raw.charCodeAt(i);
//   }
//   return buffer;
// }
// var decodeArrayBuffer = function(input) {
//   return atob(input);
// };
export function decodeArrayBuffer(input) {
  /**
   * Uses the new array typed in javascript to binary base64 encode/decode
   * at the moment just decodes a binary base64 encoded
   * into either an ArrayBuffer (decodeArrayBuffer)
   * or into an Uint8Array (decode)
   *
   * References:
   * https://developer.mozilla.org/en/JavaScript_typed_arrays/ArrayBuffer
   * https://developer.mozilla.org/en/JavaScript_typed_arrays/Uint8Array

  Copyright (c) 2011, Daniel Guerrero, BSD Licensed
  */
  var bytes = (input.length / 4) * 3;
  var arraybuffer = new ArrayBuffer(bytes);

  //get last chars to see if are valid
  var lkey1 = base64_chars.indexOf(input.charAt(input.length-1));
  var lkey2 = base64_chars.indexOf(input.charAt(input.length-2));

  if (lkey1 == 64) bytes--; //padding chars, so skip
  if (lkey2 == 64) bytes--; //padding chars, so skip

  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  var j = 0;

  var uarray = new Uint8Array(arraybuffer);

  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

  for (i=0; i<bytes; i+=3) {
    //get the 3 octects in 4 ascii chars
    enc1 = base64_chars.indexOf(input.charAt(j++));
    enc2 = base64_chars.indexOf(input.charAt(j++));
    enc3 = base64_chars.indexOf(input.charAt(j++));
    enc4 = base64_chars.indexOf(input.charAt(j++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    uarray[i] = chr1;
    if (enc3 != 64) uarray[i+1] = chr2;
    if (enc4 != 64) uarray[i+2] = chr3;
  }

  return arraybuffer;
}
