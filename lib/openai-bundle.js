(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.OpenAI = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":1,"buffer":2,"ieee754":3}],3:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MalformedJSON = exports.PartialJSON = exports.partialParse = void 0;
const STR = 0b000000001;
const NUM = 0b000000010;
const ARR = 0b000000100;
const OBJ = 0b000001000;
const NULL = 0b000010000;
const BOOL = 0b000100000;
const NAN = 0b001000000;
const INFINITY = 0b010000000;
const MINUS_INFINITY = 0b100000000;
const INF = INFINITY | MINUS_INFINITY;
const SPECIAL = NULL | BOOL | INF | NAN;
const ATOM = STR | NUM | SPECIAL;
const COLLECTION = ARR | OBJ;
const ALL = ATOM | COLLECTION;
const Allow = {
    STR,
    NUM,
    ARR,
    OBJ,
    NULL,
    BOOL,
    NAN,
    INFINITY,
    MINUS_INFINITY,
    INF,
    SPECIAL,
    ATOM,
    COLLECTION,
    ALL,
};
// The JSON string segment was unable to be parsed completely
class PartialJSON extends Error {
}
exports.PartialJSON = PartialJSON;
class MalformedJSON extends Error {
}
exports.MalformedJSON = MalformedJSON;
/**
 * Parse incomplete JSON
 * @param {string} jsonString Partial JSON to be parsed
 * @param {number} allowPartial Specify what types are allowed to be partial, see {@link Allow} for details
 * @returns The parsed JSON
 * @throws {PartialJSON} If the JSON is incomplete (related to the `allow` parameter)
 * @throws {MalformedJSON} If the JSON is malformed
 */
function parseJSON(jsonString, allowPartial = Allow.ALL) {
    if (typeof jsonString !== 'string') {
        throw new TypeError(`expecting str, got ${typeof jsonString}`);
    }
    if (!jsonString.trim()) {
        throw new Error(`${jsonString} is empty`);
    }
    return _parseJSON(jsonString.trim(), allowPartial);
}
const _parseJSON = (jsonString, allow) => {
    const length = jsonString.length;
    let index = 0;
    const markPartialJSON = (msg) => {
        throw new PartialJSON(`${msg} at position ${index}`);
    };
    const throwMalformedError = (msg) => {
        throw new MalformedJSON(`${msg} at position ${index}`);
    };
    const parseAny = () => {
        skipBlank();
        if (index >= length)
            markPartialJSON('Unexpected end of input');
        if (jsonString[index] === '"')
            return parseStr();
        if (jsonString[index] === '{')
            return parseObj();
        if (jsonString[index] === '[')
            return parseArr();
        if (jsonString.substring(index, index + 4) === 'null' ||
            (Allow.NULL & allow && length - index < 4 && 'null'.startsWith(jsonString.substring(index)))) {
            index += 4;
            return null;
        }
        if (jsonString.substring(index, index + 4) === 'true' ||
            (Allow.BOOL & allow && length - index < 4 && 'true'.startsWith(jsonString.substring(index)))) {
            index += 4;
            return true;
        }
        if (jsonString.substring(index, index + 5) === 'false' ||
            (Allow.BOOL & allow && length - index < 5 && 'false'.startsWith(jsonString.substring(index)))) {
            index += 5;
            return false;
        }
        if (jsonString.substring(index, index + 8) === 'Infinity' ||
            (Allow.INFINITY & allow && length - index < 8 && 'Infinity'.startsWith(jsonString.substring(index)))) {
            index += 8;
            return Infinity;
        }
        if (jsonString.substring(index, index + 9) === '-Infinity' ||
            (Allow.MINUS_INFINITY & allow &&
                1 < length - index &&
                length - index < 9 &&
                '-Infinity'.startsWith(jsonString.substring(index)))) {
            index += 9;
            return -Infinity;
        }
        if (jsonString.substring(index, index + 3) === 'NaN' ||
            (Allow.NAN & allow && length - index < 3 && 'NaN'.startsWith(jsonString.substring(index)))) {
            index += 3;
            return NaN;
        }
        return parseNum();
    };
    const parseStr = () => {
        const start = index;
        let escape = false;
        index++; // skip initial quote
        while (index < length && (jsonString[index] !== '"' || (escape && jsonString[index - 1] === '\\'))) {
            escape = jsonString[index] === '\\' ? !escape : false;
            index++;
        }
        if (jsonString.charAt(index) == '"') {
            try {
                return JSON.parse(jsonString.substring(start, ++index - Number(escape)));
            }
            catch (e) {
                throwMalformedError(String(e));
            }
        }
        else if (Allow.STR & allow) {
            try {
                return JSON.parse(jsonString.substring(start, index - Number(escape)) + '"');
            }
            catch (e) {
                // SyntaxError: Invalid escape sequence
                return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf('\\')) + '"');
            }
        }
        markPartialJSON('Unterminated string literal');
    };
    const parseObj = () => {
        index++; // skip initial brace
        skipBlank();
        const obj = {};
        try {
            while (jsonString[index] !== '}') {
                skipBlank();
                if (index >= length && Allow.OBJ & allow)
                    return obj;
                const key = parseStr();
                skipBlank();
                index++; // skip colon
                try {
                    const value = parseAny();
                    Object.defineProperty(obj, key, { value, writable: true, enumerable: true, configurable: true });
                }
                catch (e) {
                    if (Allow.OBJ & allow)
                        return obj;
                    else
                        throw e;
                }
                skipBlank();
                if (jsonString[index] === ',')
                    index++; // skip comma
            }
        }
        catch (e) {
            if (Allow.OBJ & allow)
                return obj;
            else
                markPartialJSON("Expected '}' at end of object");
        }
        index++; // skip final brace
        return obj;
    };
    const parseArr = () => {
        index++; // skip initial bracket
        const arr = [];
        try {
            while (jsonString[index] !== ']') {
                arr.push(parseAny());
                skipBlank();
                if (jsonString[index] === ',') {
                    index++; // skip comma
                }
            }
        }
        catch (e) {
            if (Allow.ARR & allow) {
                return arr;
            }
            markPartialJSON("Expected ']' at end of array");
        }
        index++; // skip final bracket
        return arr;
    };
    const parseNum = () => {
        if (index === 0) {
            if (jsonString === '-' && Allow.NUM & allow)
                markPartialJSON("Not sure what '-' is");
            try {
                return JSON.parse(jsonString);
            }
            catch (e) {
                if (Allow.NUM & allow) {
                    try {
                        if ('.' === jsonString[jsonString.length - 1])
                            return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf('.')));
                        return JSON.parse(jsonString.substring(0, jsonString.lastIndexOf('e')));
                    }
                    catch (e) { }
                }
                throwMalformedError(String(e));
            }
        }
        const start = index;
        if (jsonString[index] === '-')
            index++;
        while (jsonString[index] && !',]}'.includes(jsonString[index]))
            index++;
        if (index == length && !(Allow.NUM & allow))
            markPartialJSON('Unterminated number literal');
        try {
            return JSON.parse(jsonString.substring(start, index));
        }
        catch (e) {
            if (jsonString.substring(start, index) === '-' && Allow.NUM & allow)
                markPartialJSON("Not sure what '-' is");
            try {
                return JSON.parse(jsonString.substring(start, jsonString.lastIndexOf('e')));
            }
            catch (e) {
                throwMalformedError(String(e));
            }
        }
    };
    const skipBlank = () => {
        while (index < length && ' \n\r\t'.includes(jsonString[index])) {
            index++;
        }
    };
    return parseAny();
};
// using this function with malformed JSON is undefined behavior
const partialParse = (input) => parseJSON(input, Allow.ALL ^ Allow.NUM);
exports.partialParse = partialParse;

},{}],5:[function(require,module,exports){
(function (process){(function (){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAI = void 0;
const tslib_1 = require("./internal/tslib.js");
const Errors = tslib_1.__importStar(require("./error.js"));
const utils_1 = require("./internal/utils.js");
const client_1 = require("./client.js");
const headers_1 = require("./internal/headers.js");
/** API Client for interfacing with the Azure OpenAI API. */
class AzureOpenAI extends client_1.OpenAI {
    /**
     * API Client for interfacing with the Azure OpenAI API.
     *
     * @param {string | undefined} [opts.apiVersion=process.env['OPENAI_API_VERSION'] ?? undefined]
     * @param {string | undefined} [opts.endpoint=process.env['AZURE_OPENAI_ENDPOINT'] ?? undefined] - Your Azure endpoint, including the resource, e.g. `https://example-resource.azure.openai.com/`
     * @param {string | undefined} [opts.apiKey=process.env['AZURE_OPENAI_API_KEY'] ?? undefined]
     * @param {string | undefined} opts.deployment - A model deployment, if given, sets the base client URL to include `/deployments/{deployment}`.
     * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
     * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL']] - Sets the base URL for the API, e.g. `https://example-resource.azure.openai.com/openai/`.
     * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {number} [opts.httpAgent] - An HTTP agent used to manage HTTP(s) connections.
     * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {Headers} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {DefaultQuery} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */
    constructor({ baseURL = (0, utils_1.readEnv)('OPENAI_BASE_URL'), apiKey = (0, utils_1.readEnv)('AZURE_OPENAI_API_KEY'), apiVersion = (0, utils_1.readEnv)('OPENAI_API_VERSION'), endpoint, deployment, azureADTokenProvider, dangerouslyAllowBrowser, ...opts } = {}) {
        if (!apiVersion) {
            throw new Errors.OpenAIError("The OPENAI_API_VERSION environment variable is missing or empty; either provide it, or instantiate the AzureOpenAI client with an apiVersion option, like new AzureOpenAI({ apiVersion: 'My API Version' }).");
        }
        if (typeof azureADTokenProvider === 'function') {
            dangerouslyAllowBrowser = true;
        }
        if (!azureADTokenProvider && !apiKey) {
            throw new Errors.OpenAIError('Missing credentials. Please pass one of `apiKey` and `azureADTokenProvider`, or set the `AZURE_OPENAI_API_KEY` environment variable.');
        }
        if (azureADTokenProvider && apiKey) {
            throw new Errors.OpenAIError('The `apiKey` and `azureADTokenProvider` arguments are mutually exclusive; only one can be passed at a time.');
        }
        // define a sentinel value to avoid any typing issues
        apiKey ?? (apiKey = API_KEY_SENTINEL);
        opts.defaultQuery = { ...opts.defaultQuery, 'api-version': apiVersion };
        if (!baseURL) {
            if (!endpoint) {
                endpoint = process.env['AZURE_OPENAI_ENDPOINT'];
            }
            if (!endpoint) {
                throw new Errors.OpenAIError('Must provide one of the `baseURL` or `endpoint` arguments, or the `AZURE_OPENAI_ENDPOINT` environment variable');
            }
            baseURL = `${endpoint}/openai`;
        }
        else {
            if (endpoint) {
                throw new Errors.OpenAIError('baseURL and endpoint are mutually exclusive');
            }
        }
        super({
            apiKey,
            baseURL,
            ...opts,
            ...(dangerouslyAllowBrowser !== undefined ? { dangerouslyAllowBrowser } : {}),
        });
        this.apiVersion = '';
        this._azureADTokenProvider = azureADTokenProvider;
        this.apiVersion = apiVersion;
        this.deploymentName = deployment;
    }
    buildRequest(options, props = {}) {
        if (_deployments_endpoints.has(options.path) && options.method === 'post' && options.body !== undefined) {
            if (!(0, utils_1.isObj)(options.body)) {
                throw new Error('Expected request body to be an object');
            }
            const model = this.deploymentName || options.body['model'] || options.__metadata?.['model'];
            if (model !== undefined && !this.baseURL.includes('/deployments')) {
                options.path = `/deployments/${model}${options.path}`;
            }
        }
        return super.buildRequest(options, props);
    }
    async _getAzureADToken() {
        if (typeof this._azureADTokenProvider === 'function') {
            const token = await this._azureADTokenProvider();
            if (!token || typeof token !== 'string') {
                throw new Errors.OpenAIError(`Expected 'azureADTokenProvider' argument to return a string but it returned ${token}`);
            }
            return token;
        }
        return undefined;
    }
    authHeaders(opts) {
        return;
    }
    async prepareOptions(opts) {
        opts.headers = (0, headers_1.buildHeaders)([opts.headers]);
        /**
         * The user should provide a bearer token provider if they want
         * to use Azure AD authentication. The user shouldn't set the
         * Authorization header manually because the header is overwritten
         * with the Azure AD token if a bearer token provider is provided.
         */
        if (opts.headers.values.get('Authorization') || opts.headers.values.get('api-key')) {
            return super.prepareOptions(opts);
        }
        const token = await this._getAzureADToken();
        if (token) {
            opts.headers.values.set('Authorization', `Bearer ${token}`);
        }
        else if (this.apiKey !== API_KEY_SENTINEL) {
            opts.headers.values.set('api-key', this.apiKey);
        }
        else {
            throw new Errors.OpenAIError('Unable to handle auth');
        }
        return super.prepareOptions(opts);
    }
}
exports.AzureOpenAI = AzureOpenAI;
const _deployments_endpoints = new Set([
    '/completions',
    '/chat/completions',
    '/embeddings',
    '/audio/transcriptions',
    '/audio/translations',
    '/audio/speech',
    '/images/generations',
    '/batches',
    '/images/edits',
]);
const API_KEY_SENTINEL = '<Missing Key>';

}).call(this)}).call(this,require('_process'))
},{"./client.js":6,"./error.js":13,"./internal/headers.js":18,"./internal/tslib.js":27,"./internal/utils.js":29,"_process":102}],6:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _a, _OpenAI_encoder;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAI = void 0;
const tslib_1 = require("./internal/tslib.js");
const uuid_1 = require("./internal/utils/uuid.js");
const values_1 = require("./internal/utils/values.js");
const sleep_1 = require("./internal/utils/sleep.js");
const log_1 = require("./internal/utils/log.js");
const errors_1 = require("./internal/errors.js");
const detect_platform_1 = require("./internal/detect-platform.js");
const Shims = tslib_1.__importStar(require("./internal/shims.js"));
const Opts = tslib_1.__importStar(require("./internal/request-options.js"));
const qs = tslib_1.__importStar(require("./internal/qs/index.js"));
const version_1 = require("./version.js");
const Errors = tslib_1.__importStar(require("./core/error.js"));
const Pagination = tslib_1.__importStar(require("./core/pagination.js"));
const Uploads = tslib_1.__importStar(require("./core/uploads.js"));
const API = tslib_1.__importStar(require("./resources/index.js"));
const api_promise_1 = require("./core/api-promise.js");
const detect_platform_2 = require("./internal/detect-platform.js");
const headers_1 = require("./internal/headers.js");
const batches_1 = require("./resources/batches.js");
const completions_1 = require("./resources/completions.js");
const embeddings_1 = require("./resources/embeddings.js");
const files_1 = require("./resources/files.js");
const images_1 = require("./resources/images.js");
const models_1 = require("./resources/models.js");
const moderations_1 = require("./resources/moderations.js");
const env_1 = require("./internal/utils/env.js");
const log_2 = require("./internal/utils/log.js");
const values_2 = require("./internal/utils/values.js");
const audio_1 = require("./resources/audio/audio.js");
const beta_1 = require("./resources/beta/beta.js");
const chat_1 = require("./resources/chat/chat.js");
const containers_1 = require("./resources/containers/containers.js");
const evals_1 = require("./resources/evals/evals.js");
const fine_tuning_1 = require("./resources/fine-tuning/fine-tuning.js");
const graders_1 = require("./resources/graders/graders.js");
const responses_1 = require("./resources/responses/responses.js");
const uploads_1 = require("./resources/uploads/uploads.js");
const vector_stores_1 = require("./resources/vector-stores/vector-stores.js");
/**
 * API Client for interfacing with the OpenAI API.
 */
class OpenAI {
    /**
     * API Client for interfacing with the OpenAI API.
     *
     * @param {string | undefined} [opts.apiKey=process.env['OPENAI_API_KEY'] ?? undefined]
     * @param {string | null | undefined} [opts.organization=process.env['OPENAI_ORG_ID'] ?? null]
     * @param {string | null | undefined} [opts.project=process.env['OPENAI_PROJECT_ID'] ?? null]
     * @param {string} [opts.baseURL=process.env['OPENAI_BASE_URL'] ?? https://api.openai.com/v1] - Override the default base URL for the API.
     * @param {number} [opts.timeout=10 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
     * @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
     * @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
     * @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
     * @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
     * @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
     * @param {boolean} [opts.dangerouslyAllowBrowser=false] - By default, client-side use of this library is not allowed, as it risks exposing your secret API credentials to attackers.
     */
    constructor({ baseURL = (0, env_1.readEnv)('OPENAI_BASE_URL'), apiKey = (0, env_1.readEnv)('OPENAI_API_KEY'), organization = (0, env_1.readEnv)('OPENAI_ORG_ID') ?? null, project = (0, env_1.readEnv)('OPENAI_PROJECT_ID') ?? null, ...opts } = {}) {
        _OpenAI_encoder.set(this, void 0);
        this.completions = new API.Completions(this);
        this.chat = new API.Chat(this);
        this.embeddings = new API.Embeddings(this);
        this.files = new API.Files(this);
        this.images = new API.Images(this);
        this.audio = new API.Audio(this);
        this.moderations = new API.Moderations(this);
        this.models = new API.Models(this);
        this.fineTuning = new API.FineTuning(this);
        this.graders = new API.Graders(this);
        this.vectorStores = new API.VectorStores(this);
        this.beta = new API.Beta(this);
        this.batches = new API.Batches(this);
        this.uploads = new API.Uploads(this);
        this.responses = new API.Responses(this);
        this.evals = new API.Evals(this);
        this.containers = new API.Containers(this);
        if (apiKey === undefined) {
            throw new Errors.OpenAIError("The OPENAI_API_KEY environment variable is missing or empty; either provide it, or instantiate the OpenAI client with an apiKey option, like new OpenAI({ apiKey: 'My API Key' }).");
        }
        const options = {
            apiKey,
            organization,
            project,
            ...opts,
            baseURL: baseURL || `https://api.openai.com/v1`,
        };
        if (!options.dangerouslyAllowBrowser && (0, detect_platform_2.isRunningInBrowser)()) {
            throw new Errors.OpenAIError("It looks like you're running in a browser-like environment.\n\nThis is disabled by default, as it risks exposing your secret API credentials to attackers.\nIf you understand the risks and have appropriate mitigations in place,\nyou can set the `dangerouslyAllowBrowser` option to `true`, e.g.,\n\nnew OpenAI({ apiKey, dangerouslyAllowBrowser: true });\n\nhttps://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety\n");
        }
        this.baseURL = options.baseURL;
        this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT /* 10 minutes */;
        this.logger = options.logger ?? console;
        const defaultLogLevel = 'warn';
        // Set default logLevel early so that we can log a warning in parseLogLevel.
        this.logLevel = defaultLogLevel;
        this.logLevel =
            (0, log_1.parseLogLevel)(options.logLevel, 'ClientOptions.logLevel', this) ??
                (0, log_1.parseLogLevel)((0, env_1.readEnv)('OPENAI_LOG'), "process.env['OPENAI_LOG']", this) ??
                defaultLogLevel;
        this.fetchOptions = options.fetchOptions;
        this.maxRetries = options.maxRetries ?? 2;
        this.fetch = options.fetch ?? Shims.getDefaultFetch();
        tslib_1.__classPrivateFieldSet(this, _OpenAI_encoder, Opts.FallbackEncoder, "f");
        this._options = options;
        this.apiKey = apiKey;
        this.organization = organization;
        this.project = project;
    }
    /**
     * Create a new client instance re-using the same options given to the current client with optional overriding.
     */
    withOptions(options) {
        return new this.constructor({
            ...this._options,
            baseURL: this.baseURL,
            maxRetries: this.maxRetries,
            timeout: this.timeout,
            logger: this.logger,
            logLevel: this.logLevel,
            fetchOptions: this.fetchOptions,
            apiKey: this.apiKey,
            organization: this.organization,
            project: this.project,
            ...options,
        });
    }
    defaultQuery() {
        return this._options.defaultQuery;
    }
    validateHeaders({ values, nulls }) {
        return;
    }
    authHeaders(opts) {
        return (0, headers_1.buildHeaders)([{ Authorization: `Bearer ${this.apiKey}` }]);
    }
    stringifyQuery(query) {
        return qs.stringify(query, { arrayFormat: 'brackets' });
    }
    getUserAgent() {
        return `${this.constructor.name}/JS ${version_1.VERSION}`;
    }
    defaultIdempotencyKey() {
        return `stainless-node-retry-${(0, uuid_1.uuid4)()}`;
    }
    makeStatusError(status, error, message, headers) {
        return Errors.APIError.generate(status, error, message, headers);
    }
    buildURL(path, query) {
        const url = (0, values_1.isAbsoluteURL)(path) ?
            new URL(path)
            : new URL(this.baseURL + (this.baseURL.endsWith('/') && path.startsWith('/') ? path.slice(1) : path));
        const defaultQuery = this.defaultQuery();
        if (!(0, values_2.isEmptyObj)(defaultQuery)) {
            query = { ...defaultQuery, ...query };
        }
        if (typeof query === 'object' && query && !Array.isArray(query)) {
            url.search = this.stringifyQuery(query);
        }
        return url.toString();
    }
    /**
     * Used as a callback for mutating the given `FinalRequestOptions` object.
     */
    async prepareOptions(options) { }
    /**
     * Used as a callback for mutating the given `RequestInit` object.
     *
     * This is useful for cases where you want to add certain headers based off of
     * the request properties, e.g. `method` or `url`.
     */
    async prepareRequest(request, { url, options }) { }
    get(path, opts) {
        return this.methodRequest('get', path, opts);
    }
    post(path, opts) {
        return this.methodRequest('post', path, opts);
    }
    patch(path, opts) {
        return this.methodRequest('patch', path, opts);
    }
    put(path, opts) {
        return this.methodRequest('put', path, opts);
    }
    delete(path, opts) {
        return this.methodRequest('delete', path, opts);
    }
    methodRequest(method, path, opts) {
        return this.request(Promise.resolve(opts).then((opts) => {
            return { method, path, ...opts };
        }));
    }
    request(options, remainingRetries = null) {
        return new api_promise_1.APIPromise(this, this.makeRequest(options, remainingRetries, undefined));
    }
    async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
        const options = await optionsInput;
        const maxRetries = options.maxRetries ?? this.maxRetries;
        if (retriesRemaining == null) {
            retriesRemaining = maxRetries;
        }
        await this.prepareOptions(options);
        const { req, url, timeout } = this.buildRequest(options, { retryCount: maxRetries - retriesRemaining });
        await this.prepareRequest(req, { url, options });
        /** Not an API request ID, just for correlating local log entries. */
        const requestLogID = 'log_' + ((Math.random() * (1 << 24)) | 0).toString(16).padStart(6, '0');
        const retryLogStr = retryOfRequestLogID === undefined ? '' : `, retryOf: ${retryOfRequestLogID}`;
        const startTime = Date.now();
        (0, log_2.loggerFor)(this).debug(`[${requestLogID}] sending request`, (0, log_2.formatRequestDetails)({
            retryOfRequestLogID,
            method: options.method,
            url,
            options,
            headers: req.headers,
        }));
        if (options.signal?.aborted) {
            throw new Errors.APIUserAbortError();
        }
        const controller = new AbortController();
        const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(errors_1.castToError);
        const headersTime = Date.now();
        if (response instanceof Error) {
            const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
            if (options.signal?.aborted) {
                throw new Errors.APIUserAbortError();
            }
            // detect native connection timeout errors
            // deno throws "TypeError: error sending request for url (https://example/): client error (Connect): tcp connect error: Operation timed out (os error 60): Operation timed out (os error 60)"
            // undici throws "TypeError: fetch failed" with cause "ConnectTimeoutError: Connect Timeout Error (attempted address: example:443, timeout: 1ms)"
            // others do not provide enough information to distinguish timeouts from other connection errors
            const isTimeout = (0, errors_1.isAbortError)(response) ||
                /timed? ?out/i.test(String(response) + ('cause' in response ? String(response.cause) : ''));
            if (retriesRemaining) {
                (0, log_2.loggerFor)(this).info(`[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - ${retryMessage}`);
                (0, log_2.loggerFor)(this).debug(`[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (${retryMessage})`, (0, log_2.formatRequestDetails)({
                    retryOfRequestLogID,
                    url,
                    durationMs: headersTime - startTime,
                    message: response.message,
                }));
                return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
            }
            (0, log_2.loggerFor)(this).info(`[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} - error; no more retries left`);
            (0, log_2.loggerFor)(this).debug(`[${requestLogID}] connection ${isTimeout ? 'timed out' : 'failed'} (error; no more retries left)`, (0, log_2.formatRequestDetails)({
                retryOfRequestLogID,
                url,
                durationMs: headersTime - startTime,
                message: response.message,
            }));
            if (isTimeout) {
                throw new Errors.APIConnectionTimeoutError();
            }
            throw new Errors.APIConnectionError({ cause: response });
        }
        const specialHeaders = [...response.headers.entries()]
            .filter(([name]) => name === 'x-request-id')
            .map(([name, value]) => ', ' + name + ': ' + JSON.stringify(value))
            .join('');
        const responseInfo = `[${requestLogID}${retryLogStr}${specialHeaders}] ${req.method} ${url} ${response.ok ? 'succeeded' : 'failed'} with status ${response.status} in ${headersTime - startTime}ms`;
        if (!response.ok) {
            const shouldRetry = this.shouldRetry(response);
            if (retriesRemaining && shouldRetry) {
                const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
                // We don't need the body of this response.
                await Shims.CancelReadableStream(response.body);
                (0, log_2.loggerFor)(this).info(`${responseInfo} - ${retryMessage}`);
                (0, log_2.loggerFor)(this).debug(`[${requestLogID}] response error (${retryMessage})`, (0, log_2.formatRequestDetails)({
                    retryOfRequestLogID,
                    url: response.url,
                    status: response.status,
                    headers: response.headers,
                    durationMs: headersTime - startTime,
                }));
                return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
            }
            const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
            (0, log_2.loggerFor)(this).info(`${responseInfo} - ${retryMessage}`);
            const errText = await response.text().catch((err) => (0, errors_1.castToError)(err).message);
            const errJSON = (0, values_1.safeJSON)(errText);
            const errMessage = errJSON ? undefined : errText;
            (0, log_2.loggerFor)(this).debug(`[${requestLogID}] response error (${retryMessage})`, (0, log_2.formatRequestDetails)({
                retryOfRequestLogID,
                url: response.url,
                status: response.status,
                headers: response.headers,
                message: errMessage,
                durationMs: Date.now() - startTime,
            }));
            const err = this.makeStatusError(response.status, errJSON, errMessage, response.headers);
            throw err;
        }
        (0, log_2.loggerFor)(this).info(responseInfo);
        (0, log_2.loggerFor)(this).debug(`[${requestLogID}] response start`, (0, log_2.formatRequestDetails)({
            retryOfRequestLogID,
            url: response.url,
            status: response.status,
            headers: response.headers,
            durationMs: headersTime - startTime,
        }));
        return { response, options, controller, requestLogID, retryOfRequestLogID, startTime };
    }
    getAPIList(path, Page, opts) {
        return this.requestAPIList(Page, { method: 'get', path, ...opts });
    }
    requestAPIList(Page, options) {
        const request = this.makeRequest(options, null, undefined);
        return new Pagination.PagePromise(this, request, Page);
    }
    async fetchWithTimeout(url, init, ms, controller) {
        const { signal, method, ...options } = init || {};
        if (signal)
            signal.addEventListener('abort', () => controller.abort());
        const timeout = setTimeout(() => controller.abort(), ms);
        const isReadableBody = (globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream) ||
            (typeof options.body === 'object' && options.body !== null && Symbol.asyncIterator in options.body);
        const fetchOptions = {
            signal: controller.signal,
            ...(isReadableBody ? { duplex: 'half' } : {}),
            method: 'GET',
            ...options,
        };
        if (method) {
            // Custom methods like 'patch' need to be uppercased
            // See https://github.com/nodejs/undici/issues/2294
            fetchOptions.method = method.toUpperCase();
        }
        try {
            // use undefined this binding; fetch errors if bound to something else in browser/cloudflare
            return await this.fetch.call(undefined, url, fetchOptions);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    shouldRetry(response) {
        // Note this is not a standard header.
        const shouldRetryHeader = response.headers.get('x-should-retry');
        // If the server explicitly says whether or not to retry, obey.
        if (shouldRetryHeader === 'true')
            return true;
        if (shouldRetryHeader === 'false')
            return false;
        // Retry on request timeouts.
        if (response.status === 408)
            return true;
        // Retry on lock timeouts.
        if (response.status === 409)
            return true;
        // Retry on rate limits.
        if (response.status === 429)
            return true;
        // Retry internal errors.
        if (response.status >= 500)
            return true;
        return false;
    }
    async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
        let timeoutMillis;
        // Note the `retry-after-ms` header may not be standard, but is a good idea and we'd like proactive support for it.
        const retryAfterMillisHeader = responseHeaders?.get('retry-after-ms');
        if (retryAfterMillisHeader) {
            const timeoutMs = parseFloat(retryAfterMillisHeader);
            if (!Number.isNaN(timeoutMs)) {
                timeoutMillis = timeoutMs;
            }
        }
        // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
        const retryAfterHeader = responseHeaders?.get('retry-after');
        if (retryAfterHeader && !timeoutMillis) {
            const timeoutSeconds = parseFloat(retryAfterHeader);
            if (!Number.isNaN(timeoutSeconds)) {
                timeoutMillis = timeoutSeconds * 1000;
            }
            else {
                timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
            }
        }
        // If the API asks us to wait a certain amount of time (and it's a reasonable amount),
        // just do what it says, but otherwise calculate a default
        if (!(timeoutMillis && 0 <= timeoutMillis && timeoutMillis < 60 * 1000)) {
            const maxRetries = options.maxRetries ?? this.maxRetries;
            timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
        }
        await (0, sleep_1.sleep)(timeoutMillis);
        return this.makeRequest(options, retriesRemaining - 1, requestLogID);
    }
    calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
        const initialRetryDelay = 0.5;
        const maxRetryDelay = 8.0;
        const numRetries = maxRetries - retriesRemaining;
        // Apply exponential backoff, but not more than the max.
        const sleepSeconds = Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay);
        // Apply some jitter, take up to at most 25 percent of the retry time.
        const jitter = 1 - Math.random() * 0.25;
        return sleepSeconds * jitter * 1000;
    }
    buildRequest(inputOptions, { retryCount = 0 } = {}) {
        const options = { ...inputOptions };
        const { method, path, query } = options;
        const url = this.buildURL(path, query);
        if ('timeout' in options)
            (0, values_1.validatePositiveInteger)('timeout', options.timeout);
        options.timeout = options.timeout ?? this.timeout;
        const { bodyHeaders, body } = this.buildBody({ options });
        const reqHeaders = this.buildHeaders({ options: inputOptions, method, bodyHeaders, retryCount });
        const req = {
            method,
            headers: reqHeaders,
            ...(options.signal && { signal: options.signal }),
            ...(globalThis.ReadableStream &&
                body instanceof globalThis.ReadableStream && { duplex: 'half' }),
            ...(body && { body }),
            ...(this.fetchOptions ?? {}),
            ...(options.fetchOptions ?? {}),
        };
        return { req, url, timeout: options.timeout };
    }
    buildHeaders({ options, method, bodyHeaders, retryCount, }) {
        let idempotencyHeaders = {};
        if (this.idempotencyHeader && method !== 'get') {
            if (!options.idempotencyKey)
                options.idempotencyKey = this.defaultIdempotencyKey();
            idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
        }
        const headers = (0, headers_1.buildHeaders)([
            idempotencyHeaders,
            {
                Accept: 'application/json',
                'User-Agent': this.getUserAgent(),
                'X-Stainless-Retry-Count': String(retryCount),
                ...(options.timeout ? { 'X-Stainless-Timeout': String(Math.trunc(options.timeout / 1000)) } : {}),
                ...(0, detect_platform_1.getPlatformHeaders)(),
                'OpenAI-Organization': this.organization,
                'OpenAI-Project': this.project,
            },
            this.authHeaders(options),
            this._options.defaultHeaders,
            bodyHeaders,
            options.headers,
        ]);
        this.validateHeaders(headers);
        return headers.values;
    }
    buildBody({ options: { body, headers: rawHeaders } }) {
        if (!body) {
            return { bodyHeaders: undefined, body: undefined };
        }
        const headers = (0, headers_1.buildHeaders)([rawHeaders]);
        if (
        // Pass raw type verbatim
        ArrayBuffer.isView(body) ||
            body instanceof ArrayBuffer ||
            body instanceof DataView ||
            (typeof body === 'string' &&
                // Preserve legacy string encoding behavior for now
                headers.values.has('content-type')) ||
            // `Blob` is superset of `File`
            body instanceof Blob ||
            // `FormData` -> `multipart/form-data`
            body instanceof FormData ||
            // `URLSearchParams` -> `application/x-www-form-urlencoded`
            body instanceof URLSearchParams ||
            // Send chunked stream (each chunk has own `length`)
            (globalThis.ReadableStream && body instanceof globalThis.ReadableStream)) {
            return { bodyHeaders: undefined, body: body };
        }
        else if (typeof body === 'object' &&
            (Symbol.asyncIterator in body ||
                (Symbol.iterator in body && 'next' in body && typeof body.next === 'function'))) {
            return { bodyHeaders: undefined, body: Shims.ReadableStreamFrom(body) };
        }
        else {
            return tslib_1.__classPrivateFieldGet(this, _OpenAI_encoder, "f").call(this, { body, headers });
        }
    }
}
exports.OpenAI = OpenAI;
_a = OpenAI, _OpenAI_encoder = new WeakMap();
OpenAI.OpenAI = _a;
OpenAI.DEFAULT_TIMEOUT = 600000; // 10 minutes
OpenAI.OpenAIError = Errors.OpenAIError;
OpenAI.APIError = Errors.APIError;
OpenAI.APIConnectionError = Errors.APIConnectionError;
OpenAI.APIConnectionTimeoutError = Errors.APIConnectionTimeoutError;
OpenAI.APIUserAbortError = Errors.APIUserAbortError;
OpenAI.NotFoundError = Errors.NotFoundError;
OpenAI.ConflictError = Errors.ConflictError;
OpenAI.RateLimitError = Errors.RateLimitError;
OpenAI.BadRequestError = Errors.BadRequestError;
OpenAI.AuthenticationError = Errors.AuthenticationError;
OpenAI.InternalServerError = Errors.InternalServerError;
OpenAI.PermissionDeniedError = Errors.PermissionDeniedError;
OpenAI.UnprocessableEntityError = Errors.UnprocessableEntityError;
OpenAI.toFile = Uploads.toFile;
OpenAI.Completions = completions_1.Completions;
OpenAI.Chat = chat_1.Chat;
OpenAI.Embeddings = embeddings_1.Embeddings;
OpenAI.Files = files_1.Files;
OpenAI.Images = images_1.Images;
OpenAI.Audio = audio_1.Audio;
OpenAI.Moderations = moderations_1.Moderations;
OpenAI.Models = models_1.Models;
OpenAI.FineTuning = fine_tuning_1.FineTuning;
OpenAI.Graders = graders_1.Graders;
OpenAI.VectorStores = vector_stores_1.VectorStores;
OpenAI.Beta = beta_1.Beta;
OpenAI.Batches = batches_1.Batches;
OpenAI.Uploads = uploads_1.Uploads;
OpenAI.Responses = responses_1.Responses;
OpenAI.Evals = evals_1.Evals;
OpenAI.Containers = containers_1.Containers;

},{"./core/api-promise.js":7,"./core/error.js":8,"./core/pagination.js":9,"./core/uploads.js":12,"./internal/detect-platform.js":16,"./internal/errors.js":17,"./internal/headers.js":18,"./internal/qs/index.js":21,"./internal/request-options.js":24,"./internal/shims.js":25,"./internal/tslib.js":27,"./internal/utils/env.js":32,"./internal/utils/log.js":33,"./internal/utils/sleep.js":35,"./internal/utils/uuid.js":36,"./internal/utils/values.js":37,"./resources/audio/audio.js":50,"./resources/batches.js":54,"./resources/beta/beta.js":56,"./resources/chat/chat.js":64,"./resources/completions.js":69,"./resources/containers/containers.js":70,"./resources/embeddings.js":73,"./resources/evals/evals.js":74,"./resources/files.js":77,"./resources/fine-tuning/fine-tuning.js":82,"./resources/graders/graders.js":87,"./resources/images.js":88,"./resources/index.js":89,"./resources/models.js":90,"./resources/moderations.js":91,"./resources/responses/responses.js":93,"./resources/uploads/uploads.js":96,"./resources/vector-stores/vector-stores.js":99,"./version.js":101}],7:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _APIPromise_client;
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIPromise = void 0;
const tslib_1 = require("../internal/tslib.js");
const parse_1 = require("../internal/parse.js");
/**
 * A subclass of `Promise` providing additional helper methods
 * for interacting with the SDK.
 */
class APIPromise extends Promise {
    constructor(client, responsePromise, parseResponse = parse_1.defaultParseResponse) {
        super((resolve) => {
            // this is maybe a bit weird but this has to be a no-op to not implicitly
            // parse the response body; instead .then, .catch, .finally are overridden
            // to parse the response
            resolve(null);
        });
        this.responsePromise = responsePromise;
        this.parseResponse = parseResponse;
        _APIPromise_client.set(this, void 0);
        tslib_1.__classPrivateFieldSet(this, _APIPromise_client, client, "f");
    }
    _thenUnwrap(transform) {
        return new APIPromise(tslib_1.__classPrivateFieldGet(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => (0, parse_1.addRequestID)(transform(await this.parseResponse(client, props), props), props.response));
    }
    /**
     * Gets the raw `Response` instance instead of parsing the response
     * data.
     *
     * If you want to parse the response body but still get the `Response`
     * instance, you can use {@link withResponse()}.
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
     * to your `tsconfig.json`.
     */
    asResponse() {
        return this.responsePromise.then((p) => p.response);
    }
    /**
     * Gets the parsed response data, the raw `Response` instance and the ID of the request,
     * returned via the X-Request-ID header which is useful for debugging requests and reporting
     * issues to OpenAI.
     *
     * If you just want to get the raw `Response` instance without parsing it,
     * you can use {@link asResponse()}.
     *
     * 👋 Getting the wrong TypeScript type for `Response`?
     * Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
     * to your `tsconfig.json`.
     */
    async withResponse() {
        const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
        return { data, response, request_id: response.headers.get('x-request-id') };
    }
    parse() {
        if (!this.parsedPromise) {
            this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(tslib_1.__classPrivateFieldGet(this, _APIPromise_client, "f"), data));
        }
        return this.parsedPromise;
    }
    then(onfulfilled, onrejected) {
        return this.parse().then(onfulfilled, onrejected);
    }
    catch(onrejected) {
        return this.parse().catch(onrejected);
    }
    finally(onfinally) {
        return this.parse().finally(onfinally);
    }
}
exports.APIPromise = APIPromise;
_APIPromise_client = new WeakMap();

},{"../internal/parse.js":19,"../internal/tslib.js":27}],8:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentFilterFinishReasonError = exports.LengthFinishReasonError = exports.InternalServerError = exports.RateLimitError = exports.UnprocessableEntityError = exports.ConflictError = exports.NotFoundError = exports.PermissionDeniedError = exports.AuthenticationError = exports.BadRequestError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIUserAbortError = exports.APIError = exports.OpenAIError = void 0;
const errors_1 = require("../internal/errors.js");
class OpenAIError extends Error {
}
exports.OpenAIError = OpenAIError;
class APIError extends OpenAIError {
    constructor(status, error, message, headers) {
        super(`${APIError.makeMessage(status, error, message)}`);
        this.status = status;
        this.headers = headers;
        this.requestID = headers?.get('x-request-id');
        this.error = error;
        const data = error;
        this.code = data?.['code'];
        this.param = data?.['param'];
        this.type = data?.['type'];
    }
    static makeMessage(status, error, message) {
        const msg = error?.message ?
            typeof error.message === 'string' ?
                error.message
                : JSON.stringify(error.message)
            : error ? JSON.stringify(error)
                : message;
        if (status && msg) {
            return `${status} ${msg}`;
        }
        if (status) {
            return `${status} status code (no body)`;
        }
        if (msg) {
            return msg;
        }
        return '(no status code or body)';
    }
    static generate(status, errorResponse, message, headers) {
        if (!status || !headers) {
            return new APIConnectionError({ message, cause: (0, errors_1.castToError)(errorResponse) });
        }
        const error = errorResponse?.['error'];
        if (status === 400) {
            return new BadRequestError(status, error, message, headers);
        }
        if (status === 401) {
            return new AuthenticationError(status, error, message, headers);
        }
        if (status === 403) {
            return new PermissionDeniedError(status, error, message, headers);
        }
        if (status === 404) {
            return new NotFoundError(status, error, message, headers);
        }
        if (status === 409) {
            return new ConflictError(status, error, message, headers);
        }
        if (status === 422) {
            return new UnprocessableEntityError(status, error, message, headers);
        }
        if (status === 429) {
            return new RateLimitError(status, error, message, headers);
        }
        if (status >= 500) {
            return new InternalServerError(status, error, message, headers);
        }
        return new APIError(status, error, message, headers);
    }
}
exports.APIError = APIError;
class APIUserAbortError extends APIError {
    constructor({ message } = {}) {
        super(undefined, undefined, message || 'Request was aborted.', undefined);
    }
}
exports.APIUserAbortError = APIUserAbortError;
class APIConnectionError extends APIError {
    constructor({ message, cause }) {
        super(undefined, undefined, message || 'Connection error.', undefined);
        // in some environments the 'cause' property is already declared
        // @ts-ignore
        if (cause)
            this.cause = cause;
    }
}
exports.APIConnectionError = APIConnectionError;
class APIConnectionTimeoutError extends APIConnectionError {
    constructor({ message } = {}) {
        super({ message: message ?? 'Request timed out.' });
    }
}
exports.APIConnectionTimeoutError = APIConnectionTimeoutError;
class BadRequestError extends APIError {
}
exports.BadRequestError = BadRequestError;
class AuthenticationError extends APIError {
}
exports.AuthenticationError = AuthenticationError;
class PermissionDeniedError extends APIError {
}
exports.PermissionDeniedError = PermissionDeniedError;
class NotFoundError extends APIError {
}
exports.NotFoundError = NotFoundError;
class ConflictError extends APIError {
}
exports.ConflictError = ConflictError;
class UnprocessableEntityError extends APIError {
}
exports.UnprocessableEntityError = UnprocessableEntityError;
class RateLimitError extends APIError {
}
exports.RateLimitError = RateLimitError;
class InternalServerError extends APIError {
}
exports.InternalServerError = InternalServerError;
class LengthFinishReasonError extends OpenAIError {
    constructor() {
        super(`Could not parse response content as the length limit was reached`);
    }
}
exports.LengthFinishReasonError = LengthFinishReasonError;
class ContentFilterFinishReasonError extends OpenAIError {
    constructor() {
        super(`Could not parse response content as the request was rejected by the content filter`);
    }
}
exports.ContentFilterFinishReasonError = ContentFilterFinishReasonError;

},{"../internal/errors.js":17}],9:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var _AbstractPage_client;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorPage = exports.Page = exports.PagePromise = exports.AbstractPage = void 0;
const tslib_1 = require("../internal/tslib.js");
const error_1 = require("./error.js");
const parse_1 = require("../internal/parse.js");
const api_promise_1 = require("./api-promise.js");
const values_1 = require("../internal/utils/values.js");
class AbstractPage {
    constructor(client, response, body, options) {
        _AbstractPage_client.set(this, void 0);
        tslib_1.__classPrivateFieldSet(this, _AbstractPage_client, client, "f");
        this.options = options;
        this.response = response;
        this.body = body;
    }
    hasNextPage() {
        const items = this.getPaginatedItems();
        if (!items.length)
            return false;
        return this.nextPageRequestOptions() != null;
    }
    async getNextPage() {
        const nextOptions = this.nextPageRequestOptions();
        if (!nextOptions) {
            throw new error_1.OpenAIError('No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.');
        }
        return await tslib_1.__classPrivateFieldGet(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
    }
    async *iterPages() {
        let page = this;
        yield page;
        while (page.hasNextPage()) {
            page = await page.getNextPage();
            yield page;
        }
    }
    async *[(_AbstractPage_client = new WeakMap(), Symbol.asyncIterator)]() {
        for await (const page of this.iterPages()) {
            for (const item of page.getPaginatedItems()) {
                yield item;
            }
        }
    }
}
exports.AbstractPage = AbstractPage;
/**
 * This subclass of Promise will resolve to an instantiated Page once the request completes.
 *
 * It also implements AsyncIterable to allow auto-paginating iteration on an unawaited list call, eg:
 *
 *    for await (const item of client.items.list()) {
 *      console.log(item)
 *    }
 */
class PagePromise extends api_promise_1.APIPromise {
    constructor(client, request, Page) {
        super(client, request, async (client, props) => new Page(client, props.response, await (0, parse_1.defaultParseResponse)(client, props), props.options));
    }
    /**
     * Allow auto-paginating iteration on an unawaited list call, eg:
     *
     *    for await (const item of client.items.list()) {
     *      console.log(item)
     *    }
     */
    async *[Symbol.asyncIterator]() {
        const page = await this;
        for await (const item of page) {
            yield item;
        }
    }
}
exports.PagePromise = PagePromise;
/**
 * Note: no pagination actually occurs yet, this is for forwards-compatibility.
 */
class Page extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.data = body.data || [];
        this.object = body.object;
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    nextPageRequestOptions() {
        return null;
    }
}
exports.Page = Page;
class CursorPage extends AbstractPage {
    constructor(client, response, body, options) {
        super(client, response, body, options);
        this.data = body.data || [];
        this.has_more = body.has_more || false;
    }
    getPaginatedItems() {
        return this.data ?? [];
    }
    hasNextPage() {
        if (this.has_more === false) {
            return false;
        }
        return super.hasNextPage();
    }
    nextPageRequestOptions() {
        const data = this.getPaginatedItems();
        const id = data[data.length - 1]?.id;
        if (!id) {
            return null;
        }
        return {
            ...this.options,
            query: {
                ...(0, values_1.maybeObj)(this.options.query),
                after: id,
            },
        };
    }
}
exports.CursorPage = CursorPage;

},{"../internal/parse.js":19,"../internal/tslib.js":27,"../internal/utils/values.js":37,"./api-promise.js":7,"./error.js":8}],10:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIResource = void 0;
class APIResource {
    constructor(client) {
        this._client = client;
    }
}
exports.APIResource = APIResource;

},{}],11:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Stream = void 0;
exports._iterSSEMessages = _iterSSEMessages;
const error_1 = require("./error.js");
const shims_1 = require("../internal/shims.js");
const line_1 = require("../internal/decoders/line.js");
const shims_2 = require("../internal/shims.js");
const errors_1 = require("../internal/errors.js");
const bytes_1 = require("../internal/utils/bytes.js");
const error_2 = require("./error.js");
class Stream {
    constructor(iterator, controller) {
        this.iterator = iterator;
        this.controller = controller;
    }
    static fromSSEResponse(response, controller) {
        let consumed = false;
        async function* iterator() {
            if (consumed) {
                throw new error_1.OpenAIError('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const sse of _iterSSEMessages(response, controller)) {
                    if (done)
                        continue;
                    if (sse.data.startsWith('[DONE]')) {
                        done = true;
                        continue;
                    }
                    if (sse.event === null ||
                        sse.event.startsWith('response.') ||
                        sse.event.startsWith('transcript.')) {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        }
                        catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        if (data && data.error) {
                            throw new error_2.APIError(undefined, data.error, undefined, response.headers);
                        }
                        yield data;
                    }
                    else {
                        let data;
                        try {
                            data = JSON.parse(sse.data);
                        }
                        catch (e) {
                            console.error(`Could not parse message into JSON:`, sse.data);
                            console.error(`From chunk:`, sse.raw);
                            throw e;
                        }
                        // TODO: Is this where the error should be thrown?
                        if (sse.event == 'error') {
                            throw new error_2.APIError(undefined, data.error, data.message, undefined);
                        }
                        yield { event: sse.event, data: data };
                    }
                }
                done = true;
            }
            catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if ((0, errors_1.isAbortError)(e))
                    return;
                throw e;
            }
            finally {
                // If the user `break`s, abort the ongoing request.
                if (!done)
                    controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    /**
     * Generates a Stream from a newline-separated ReadableStream
     * where each item is a JSON value.
     */
    static fromReadableStream(readableStream, controller) {
        let consumed = false;
        async function* iterLines() {
            const lineDecoder = new line_1.LineDecoder();
            const iter = (0, shims_2.ReadableStreamToAsyncIterable)(readableStream);
            for await (const chunk of iter) {
                for (const line of lineDecoder.decode(chunk)) {
                    yield line;
                }
            }
            for (const line of lineDecoder.flush()) {
                yield line;
            }
        }
        async function* iterator() {
            if (consumed) {
                throw new error_1.OpenAIError('Cannot iterate over a consumed stream, use `.tee()` to split the stream.');
            }
            consumed = true;
            let done = false;
            try {
                for await (const line of iterLines()) {
                    if (done)
                        continue;
                    if (line)
                        yield JSON.parse(line);
                }
                done = true;
            }
            catch (e) {
                // If the user calls `stream.controller.abort()`, we should exit without throwing.
                if ((0, errors_1.isAbortError)(e))
                    return;
                throw e;
            }
            finally {
                // If the user `break`s, abort the ongoing request.
                if (!done)
                    controller.abort();
            }
        }
        return new Stream(iterator, controller);
    }
    [Symbol.asyncIterator]() {
        return this.iterator();
    }
    /**
     * Splits the stream into two streams which can be
     * independently read from at different speeds.
     */
    tee() {
        const left = [];
        const right = [];
        const iterator = this.iterator();
        const teeIterator = (queue) => {
            return {
                next: () => {
                    if (queue.length === 0) {
                        const result = iterator.next();
                        left.push(result);
                        right.push(result);
                    }
                    return queue.shift();
                },
            };
        };
        return [
            new Stream(() => teeIterator(left), this.controller),
            new Stream(() => teeIterator(right), this.controller),
        ];
    }
    /**
     * Converts this stream to a newline-separated ReadableStream of
     * JSON stringified values in the stream
     * which can be turned back into a Stream with `Stream.fromReadableStream()`.
     */
    toReadableStream() {
        const self = this;
        let iter;
        return (0, shims_1.makeReadableStream)({
            async start() {
                iter = self[Symbol.asyncIterator]();
            },
            async pull(ctrl) {
                try {
                    const { value, done } = await iter.next();
                    if (done)
                        return ctrl.close();
                    const bytes = (0, bytes_1.encodeUTF8)(JSON.stringify(value) + '\n');
                    ctrl.enqueue(bytes);
                }
                catch (err) {
                    ctrl.error(err);
                }
            },
            async cancel() {
                await iter.return?.();
            },
        });
    }
}
exports.Stream = Stream;
async function* _iterSSEMessages(response, controller) {
    if (!response.body) {
        controller.abort();
        if (typeof globalThis.navigator !== 'undefined' &&
            globalThis.navigator.product === 'ReactNative') {
            throw new error_1.OpenAIError(`The default react-native fetch implementation does not support streaming. Please use expo/fetch: https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api`);
        }
        throw new error_1.OpenAIError(`Attempted to iterate over a response with no body`);
    }
    const sseDecoder = new SSEDecoder();
    const lineDecoder = new line_1.LineDecoder();
    const iter = (0, shims_2.ReadableStreamToAsyncIterable)(response.body);
    for await (const sseChunk of iterSSEChunks(iter)) {
        for (const line of lineDecoder.decode(sseChunk)) {
            const sse = sseDecoder.decode(line);
            if (sse)
                yield sse;
        }
    }
    for (const line of lineDecoder.flush()) {
        const sse = sseDecoder.decode(line);
        if (sse)
            yield sse;
    }
}
/**
 * Given an async iterable iterator, iterates over it and yields full
 * SSE chunks, i.e. yields when a double new-line is encountered.
 */
async function* iterSSEChunks(iterator) {
    let data = new Uint8Array();
    for await (const chunk of iterator) {
        if (chunk == null) {
            continue;
        }
        const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
            : typeof chunk === 'string' ? (0, bytes_1.encodeUTF8)(chunk)
                : chunk;
        let newData = new Uint8Array(data.length + binaryChunk.length);
        newData.set(data);
        newData.set(binaryChunk, data.length);
        data = newData;
        let patternIndex;
        while ((patternIndex = (0, line_1.findDoubleNewlineIndex)(data)) !== -1) {
            yield data.slice(0, patternIndex);
            data = data.slice(patternIndex);
        }
    }
    if (data.length > 0) {
        yield data;
    }
}
class SSEDecoder {
    constructor() {
        this.event = null;
        this.data = [];
        this.chunks = [];
    }
    decode(line) {
        if (line.endsWith('\r')) {
            line = line.substring(0, line.length - 1);
        }
        if (!line) {
            // empty line and we didn't previously encounter any messages
            if (!this.event && !this.data.length)
                return null;
            const sse = {
                event: this.event,
                data: this.data.join('\n'),
                raw: this.chunks,
            };
            this.event = null;
            this.data = [];
            this.chunks = [];
            return sse;
        }
        this.chunks.push(line);
        if (line.startsWith(':')) {
            return null;
        }
        let [fieldname, _, value] = partition(line, ':');
        if (value.startsWith(' ')) {
            value = value.substring(1);
        }
        if (fieldname === 'event') {
            this.event = value;
        }
        else if (fieldname === 'data') {
            this.data.push(value);
        }
        return null;
    }
}
function partition(str, delimiter) {
    const index = str.indexOf(delimiter);
    if (index !== -1) {
        return [str.substring(0, index), delimiter, str.substring(index + delimiter.length)];
    }
    return [str, '', ''];
}

},{"../internal/decoders/line.js":15,"../internal/errors.js":17,"../internal/shims.js":25,"../internal/utils/bytes.js":31,"./error.js":8}],12:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFile = void 0;
var to_file_1 = require("../internal/to-file.js");
Object.defineProperty(exports, "toFile", { enumerable: true, get: function () { return to_file_1.toFile; } });

},{"../internal/to-file.js":26}],13:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("./internal/tslib.js");
/** @deprecated Import from ./core/error instead */
tslib_1.__exportStar(require("./core/error.js"), exports);

},{"./core/error.js":8,"./internal/tslib.js":27}],14:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
exports = module.exports = function (...args) {
  return new exports.default(...args)
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureOpenAI = exports.UnprocessableEntityError = exports.PermissionDeniedError = exports.InternalServerError = exports.AuthenticationError = exports.BadRequestError = exports.RateLimitError = exports.ConflictError = exports.NotFoundError = exports.APIUserAbortError = exports.APIConnectionTimeoutError = exports.APIConnectionError = exports.APIError = exports.OpenAIError = exports.PagePromise = exports.OpenAI = exports.APIPromise = exports.toFile = exports.default = void 0;
var client_1 = require("./client.js");
Object.defineProperty(exports, "default", { enumerable: true, get: function () { return client_1.OpenAI; } });
var uploads_1 = require("./core/uploads.js");
Object.defineProperty(exports, "toFile", { enumerable: true, get: function () { return uploads_1.toFile; } });
var api_promise_1 = require("./core/api-promise.js");
Object.defineProperty(exports, "APIPromise", { enumerable: true, get: function () { return api_promise_1.APIPromise; } });
var client_2 = require("./client.js");
Object.defineProperty(exports, "OpenAI", { enumerable: true, get: function () { return client_2.OpenAI; } });
var pagination_1 = require("./core/pagination.js");
Object.defineProperty(exports, "PagePromise", { enumerable: true, get: function () { return pagination_1.PagePromise; } });
var error_1 = require("./core/error.js");
Object.defineProperty(exports, "OpenAIError", { enumerable: true, get: function () { return error_1.OpenAIError; } });
Object.defineProperty(exports, "APIError", { enumerable: true, get: function () { return error_1.APIError; } });
Object.defineProperty(exports, "APIConnectionError", { enumerable: true, get: function () { return error_1.APIConnectionError; } });
Object.defineProperty(exports, "APIConnectionTimeoutError", { enumerable: true, get: function () { return error_1.APIConnectionTimeoutError; } });
Object.defineProperty(exports, "APIUserAbortError", { enumerable: true, get: function () { return error_1.APIUserAbortError; } });
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return error_1.NotFoundError; } });
Object.defineProperty(exports, "ConflictError", { enumerable: true, get: function () { return error_1.ConflictError; } });
Object.defineProperty(exports, "RateLimitError", { enumerable: true, get: function () { return error_1.RateLimitError; } });
Object.defineProperty(exports, "BadRequestError", { enumerable: true, get: function () { return error_1.BadRequestError; } });
Object.defineProperty(exports, "AuthenticationError", { enumerable: true, get: function () { return error_1.AuthenticationError; } });
Object.defineProperty(exports, "InternalServerError", { enumerable: true, get: function () { return error_1.InternalServerError; } });
Object.defineProperty(exports, "PermissionDeniedError", { enumerable: true, get: function () { return error_1.PermissionDeniedError; } });
Object.defineProperty(exports, "UnprocessableEntityError", { enumerable: true, get: function () { return error_1.UnprocessableEntityError; } });
var azure_1 = require("./azure.js");
Object.defineProperty(exports, "AzureOpenAI", { enumerable: true, get: function () { return azure_1.AzureOpenAI; } });


},{"./azure.js":5,"./client.js":6,"./core/api-promise.js":7,"./core/error.js":8,"./core/pagination.js":9,"./core/uploads.js":12}],15:[function(require,module,exports){
"use strict";
var _LineDecoder_buffer, _LineDecoder_carriageReturnIndex;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LineDecoder = void 0;
exports.findDoubleNewlineIndex = findDoubleNewlineIndex;
const tslib_1 = require("../tslib.js");
const bytes_1 = require("../utils/bytes.js");
/**
 * A re-implementation of httpx's `LineDecoder` in Python that handles incrementally
 * reading lines from text.
 *
 * https://github.com/encode/httpx/blob/920333ea98118e9cf617f246905d7b202510941c/httpx/_decoders.py#L258
 */
class LineDecoder {
    constructor() {
        _LineDecoder_buffer.set(this, void 0);
        _LineDecoder_carriageReturnIndex.set(this, void 0);
        tslib_1.__classPrivateFieldSet(this, _LineDecoder_buffer, new Uint8Array(), "f");
        tslib_1.__classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
    }
    decode(chunk) {
        if (chunk == null) {
            return [];
        }
        const binaryChunk = chunk instanceof ArrayBuffer ? new Uint8Array(chunk)
            : typeof chunk === 'string' ? (0, bytes_1.encodeUTF8)(chunk)
                : chunk;
        tslib_1.__classPrivateFieldSet(this, _LineDecoder_buffer, (0, bytes_1.concatBytes)([tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), binaryChunk]), "f");
        const lines = [];
        let patternIndex;
        while ((patternIndex = findNewlineIndex(tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f"), tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f"))) != null) {
            if (patternIndex.carriage && tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") == null) {
                // skip until we either get a corresponding `\n`, a new `\r` or nothing
                tslib_1.__classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, patternIndex.index, "f");
                continue;
            }
            // we got double \r or \rtext\n
            if (tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") != null &&
                (patternIndex.index !== tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") + 1 || patternIndex.carriage)) {
                lines.push((0, bytes_1.decodeUTF8)(tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") - 1)));
                tslib_1.__classPrivateFieldSet(this, _LineDecoder_buffer, tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f")), "f");
                tslib_1.__classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
                continue;
            }
            const endIndex = tslib_1.__classPrivateFieldGet(this, _LineDecoder_carriageReturnIndex, "f") !== null ? patternIndex.preceding - 1 : patternIndex.preceding;
            const line = (0, bytes_1.decodeUTF8)(tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(0, endIndex));
            lines.push(line);
            tslib_1.__classPrivateFieldSet(this, _LineDecoder_buffer, tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f").subarray(patternIndex.index), "f");
            tslib_1.__classPrivateFieldSet(this, _LineDecoder_carriageReturnIndex, null, "f");
        }
        return lines;
    }
    flush() {
        if (!tslib_1.__classPrivateFieldGet(this, _LineDecoder_buffer, "f").length) {
            return [];
        }
        return this.decode('\n');
    }
}
exports.LineDecoder = LineDecoder;
_LineDecoder_buffer = new WeakMap(), _LineDecoder_carriageReturnIndex = new WeakMap();
// prettier-ignore
LineDecoder.NEWLINE_CHARS = new Set(['\n', '\r']);
LineDecoder.NEWLINE_REGEXP = /\r\n|[\n\r]/g;
/**
 * This function searches the buffer for the end patterns, (\r or \n)
 * and returns an object with the index preceding the matched newline and the
 * index after the newline char. `null` is returned if no new line is found.
 *
 * ```ts
 * findNewLineIndex('abc\ndef') -> { preceding: 2, index: 3 }
 * ```
 */
function findNewlineIndex(buffer, startIndex) {
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for (let i = startIndex ?? 0; i < buffer.length; i++) {
        if (buffer[i] === newline) {
            return { preceding: i, index: i + 1, carriage: false };
        }
        if (buffer[i] === carriage) {
            return { preceding: i, index: i + 1, carriage: true };
        }
    }
    return null;
}
function findDoubleNewlineIndex(buffer) {
    // This function searches the buffer for the end patterns (\r\r, \n\n, \r\n\r\n)
    // and returns the index right after the first occurrence of any pattern,
    // or -1 if none of the patterns are found.
    const newline = 0x0a; // \n
    const carriage = 0x0d; // \r
    for (let i = 0; i < buffer.length - 1; i++) {
        if (buffer[i] === newline && buffer[i + 1] === newline) {
            // \n\n
            return i + 2;
        }
        if (buffer[i] === carriage && buffer[i + 1] === carriage) {
            // \r\r
            return i + 2;
        }
        if (buffer[i] === carriage &&
            buffer[i + 1] === newline &&
            i + 3 < buffer.length &&
            buffer[i + 2] === carriage &&
            buffer[i + 3] === newline) {
            // \r\n\r\n
            return i + 4;
        }
    }
    return -1;
}

},{"../tslib.js":27,"../utils/bytes.js":31}],16:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformHeaders = exports.isRunningInBrowser = void 0;
const version_1 = require("../version.js");
const isRunningInBrowser = () => {
    return (
    // @ts-ignore
    typeof window !== 'undefined' &&
        // @ts-ignore
        typeof window.document !== 'undefined' &&
        // @ts-ignore
        typeof navigator !== 'undefined');
};
exports.isRunningInBrowser = isRunningInBrowser;
/**
 * Note this does not detect 'browser'; for that, use getBrowserInfo().
 */
function getDetectedPlatform() {
    if (typeof Deno !== 'undefined' && Deno.build != null) {
        return 'deno';
    }
    if (typeof EdgeRuntime !== 'undefined') {
        return 'edge';
    }
    if (Object.prototype.toString.call(typeof globalThis.process !== 'undefined' ? globalThis.process : 0) === '[object process]') {
        return 'node';
    }
    return 'unknown';
}
const getPlatformProperties = () => {
    const detectedPlatform = getDetectedPlatform();
    if (detectedPlatform === 'deno') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': normalizePlatform(Deno.build.os),
            'X-Stainless-Arch': normalizeArch(Deno.build.arch),
            'X-Stainless-Runtime': 'deno',
            'X-Stainless-Runtime-Version': typeof Deno.version === 'string' ? Deno.version : Deno.version?.deno ?? 'unknown',
        };
    }
    if (typeof EdgeRuntime !== 'undefined') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': `other:${EdgeRuntime}`,
            'X-Stainless-Runtime': 'edge',
            'X-Stainless-Runtime-Version': globalThis.process.version,
        };
    }
    // Check if Node.js
    if (detectedPlatform === 'node') {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': normalizePlatform(globalThis.process.platform ?? 'unknown'),
            'X-Stainless-Arch': normalizeArch(globalThis.process.arch ?? 'unknown'),
            'X-Stainless-Runtime': 'node',
            'X-Stainless-Runtime-Version': globalThis.process.version ?? 'unknown',
        };
    }
    const browserInfo = getBrowserInfo();
    if (browserInfo) {
        return {
            'X-Stainless-Lang': 'js',
            'X-Stainless-Package-Version': version_1.VERSION,
            'X-Stainless-OS': 'Unknown',
            'X-Stainless-Arch': 'unknown',
            'X-Stainless-Runtime': `browser:${browserInfo.browser}`,
            'X-Stainless-Runtime-Version': browserInfo.version,
        };
    }
    // TODO add support for Cloudflare workers, etc.
    return {
        'X-Stainless-Lang': 'js',
        'X-Stainless-Package-Version': version_1.VERSION,
        'X-Stainless-OS': 'Unknown',
        'X-Stainless-Arch': 'unknown',
        'X-Stainless-Runtime': 'unknown',
        'X-Stainless-Runtime-Version': 'unknown',
    };
};
// Note: modified from https://github.com/JS-DevTools/host-environment/blob/b1ab79ecde37db5d6e163c050e54fe7d287d7c92/src/isomorphic.browser.ts
function getBrowserInfo() {
    if (typeof navigator === 'undefined' || !navigator) {
        return null;
    }
    // NOTE: The order matters here!
    const browserPatterns = [
        { key: 'edge', pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'ie', pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'ie', pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'chrome', pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'firefox', pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/ },
        { key: 'safari', pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/ },
    ];
    // Find the FIRST matching browser
    for (const { key, pattern } of browserPatterns) {
        const match = pattern.exec(navigator.userAgent);
        if (match) {
            const major = match[1] || 0;
            const minor = match[2] || 0;
            const patch = match[3] || 0;
            return { browser: key, version: `${major}.${minor}.${patch}` };
        }
    }
    return null;
}
const normalizeArch = (arch) => {
    // Node docs:
    // - https://nodejs.org/api/process.html#processarch
    // Deno docs:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    if (arch === 'x32')
        return 'x32';
    if (arch === 'x86_64' || arch === 'x64')
        return 'x64';
    if (arch === 'arm')
        return 'arm';
    if (arch === 'aarch64' || arch === 'arm64')
        return 'arm64';
    if (arch)
        return `other:${arch}`;
    return 'unknown';
};
const normalizePlatform = (platform) => {
    // Node platforms:
    // - https://nodejs.org/api/process.html#processplatform
    // Deno platforms:
    // - https://doc.deno.land/deno/stable/~/Deno.build
    // - https://github.com/denoland/deno/issues/14799
    platform = platform.toLowerCase();
    // NOTE: this iOS check is untested and may not work
    // Node does not work natively on IOS, there is a fork at
    // https://github.com/nodejs-mobile/nodejs-mobile
    // however it is unknown at the time of writing how to detect if it is running
    if (platform.includes('ios'))
        return 'iOS';
    if (platform === 'android')
        return 'Android';
    if (platform === 'darwin')
        return 'MacOS';
    if (platform === 'win32')
        return 'Windows';
    if (platform === 'freebsd')
        return 'FreeBSD';
    if (platform === 'openbsd')
        return 'OpenBSD';
    if (platform === 'linux')
        return 'Linux';
    if (platform)
        return `Other:${platform}`;
    return 'Unknown';
};
let _platformHeaders;
const getPlatformHeaders = () => {
    return (_platformHeaders ?? (_platformHeaders = getPlatformProperties()));
};
exports.getPlatformHeaders = getPlatformHeaders;

},{"../version.js":101}],17:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.castToError = void 0;
exports.isAbortError = isAbortError;
function isAbortError(err) {
    return (typeof err === 'object' &&
        err !== null &&
        // Spec-compliant fetch implementations
        (('name' in err && err.name === 'AbortError') ||
            // Expo fetch
            ('message' in err && String(err.message).includes('FetchRequestCanceledException'))));
}
const castToError = (err) => {
    if (err instanceof Error)
        return err;
    if (typeof err === 'object' && err !== null) {
        try {
            if (Object.prototype.toString.call(err) === '[object Error]') {
                // @ts-ignore - not all envs have native support for cause yet
                const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
                if (err.stack)
                    error.stack = err.stack;
                // @ts-ignore - not all envs have native support for cause yet
                if (err.cause && !error.cause)
                    error.cause = err.cause;
                if (err.name)
                    error.name = err.name;
                return error;
            }
        }
        catch { }
        try {
            return new Error(JSON.stringify(err));
        }
        catch { }
    }
    return new Error(err);
};
exports.castToError = castToError;

},{}],18:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmptyHeaders = exports.buildHeaders = void 0;
const brand_privateNullableHeaders = Symbol('brand.privateNullableHeaders');
const isArray = Array.isArray;
function* iterateHeaders(headers) {
    if (!headers)
        return;
    if (brand_privateNullableHeaders in headers) {
        const { values, nulls } = headers;
        yield* values.entries();
        for (const name of nulls) {
            yield [name, null];
        }
        return;
    }
    let shouldClear = false;
    let iter;
    if (headers instanceof Headers) {
        iter = headers.entries();
    }
    else if (isArray(headers)) {
        iter = headers;
    }
    else {
        shouldClear = true;
        iter = Object.entries(headers ?? {});
    }
    for (let row of iter) {
        const name = row[0];
        if (typeof name !== 'string')
            throw new TypeError('expected header name to be a string');
        const values = isArray(row[1]) ? row[1] : [row[1]];
        let didClear = false;
        for (const value of values) {
            if (value === undefined)
                continue;
            // Objects keys always overwrite older headers, they never append.
            // Yield a null to clear the header before adding the new values.
            if (shouldClear && !didClear) {
                didClear = true;
                yield [name, null];
            }
            yield [name, value];
        }
    }
}
const buildHeaders = (newHeaders) => {
    const targetHeaders = new Headers();
    const nullHeaders = new Set();
    for (const headers of newHeaders) {
        const seenHeaders = new Set();
        for (const [name, value] of iterateHeaders(headers)) {
            const lowerName = name.toLowerCase();
            if (!seenHeaders.has(lowerName)) {
                targetHeaders.delete(name);
                seenHeaders.add(lowerName);
            }
            if (value === null) {
                targetHeaders.delete(name);
                nullHeaders.add(lowerName);
            }
            else {
                targetHeaders.append(name, value);
                nullHeaders.delete(lowerName);
            }
        }
    }
    return { [brand_privateNullableHeaders]: true, values: targetHeaders, nulls: nullHeaders };
};
exports.buildHeaders = buildHeaders;
const isEmptyHeaders = (headers) => {
    for (const _ of iterateHeaders(headers))
        return false;
    return true;
};
exports.isEmptyHeaders = isEmptyHeaders;

},{}],19:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultParseResponse = defaultParseResponse;
exports.addRequestID = addRequestID;
const streaming_1 = require("../core/streaming.js");
const log_1 = require("./utils/log.js");
async function defaultParseResponse(client, props) {
    const { response, requestLogID, retryOfRequestLogID, startTime } = props;
    const body = await (async () => {
        if (props.options.stream) {
            (0, log_1.loggerFor)(client).debug('response', response.status, response.url, response.headers, response.body);
            // Note: there is an invariant here that isn't represented in the type system
            // that if you set `stream: true` the response type must also be `Stream<T>`
            if (props.options.__streamClass) {
                return props.options.__streamClass.fromSSEResponse(response, props.controller);
            }
            return streaming_1.Stream.fromSSEResponse(response, props.controller);
        }
        // fetch refuses to read the body when the status code is 204.
        if (response.status === 204) {
            return null;
        }
        if (props.options.__binaryResponse) {
            return response;
        }
        const contentType = response.headers.get('content-type');
        const mediaType = contentType?.split(';')[0]?.trim();
        const isJSON = mediaType?.includes('application/json') || mediaType?.endsWith('+json');
        if (isJSON) {
            const json = await response.json();
            return addRequestID(json, response);
        }
        const text = await response.text();
        return text;
    })();
    (0, log_1.loggerFor)(client).debug(`[${requestLogID}] response parsed`, (0, log_1.formatRequestDetails)({
        retryOfRequestLogID,
        url: response.url,
        status: response.status,
        body,
        durationMs: Date.now() - startTime,
    }));
    return body;
}
function addRequestID(value, response) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
    }
    return Object.defineProperty(value, '_request_id', {
        value: response.headers.get('x-request-id'),
        enumerable: false,
    });
}

},{"../core/streaming.js":11,"./utils/log.js":33}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RFC3986 = exports.RFC1738 = exports.formatters = exports.default_format = void 0;
exports.default_format = 'RFC3986';
exports.formatters = {
    RFC1738: (v) => String(v).replace(/%20/g, '+'),
    RFC3986: (v) => String(v),
};
exports.RFC1738 = 'RFC1738';
exports.RFC3986 = 'RFC3986';

},{}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formats = exports.stringify = void 0;
const formats_1 = require("./formats.js");
const formats = {
    formatters: formats_1.formatters,
    RFC1738: formats_1.RFC1738,
    RFC3986: formats_1.RFC3986,
    default: formats_1.default_format,
};
exports.formats = formats;
var stringify_1 = require("./stringify.js");
Object.defineProperty(exports, "stringify", { enumerable: true, get: function () { return stringify_1.stringify; } });

},{"./formats.js":20,"./stringify.js":22}],22:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringify = stringify;
const utils_1 = require("./utils.js");
const formats_1 = require("./formats.js");
const has = Object.prototype.hasOwnProperty;
const array_prefix_generators = {
    brackets(prefix) {
        return String(prefix) + '[]';
    },
    comma: 'comma',
    indices(prefix, key) {
        return String(prefix) + '[' + key + ']';
    },
    repeat(prefix) {
        return String(prefix);
    },
};
const is_array = Array.isArray;
const push = Array.prototype.push;
const push_to_array = function (arr, value_or_array) {
    push.apply(arr, is_array(value_or_array) ? value_or_array : [value_or_array]);
};
const to_ISO = Date.prototype.toISOString;
const defaults = {
    addQueryPrefix: false,
    allowDots: false,
    allowEmptyArrays: false,
    arrayFormat: 'indices',
    charset: 'utf-8',
    charsetSentinel: false,
    delimiter: '&',
    encode: true,
    encodeDotInKeys: false,
    encoder: utils_1.encode,
    encodeValuesOnly: false,
    format: formats_1.default_format,
    formatter: formats_1.formatters[formats_1.default_format],
    /** @deprecated */
    indices: false,
    serializeDate(date) {
        return to_ISO.call(date);
    },
    skipNulls: false,
    strictNullHandling: false,
};
function is_non_nullish_primitive(v) {
    return (typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        typeof v === 'symbol' ||
        typeof v === 'bigint');
}
const sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
    let obj = object;
    let tmp_sc = sideChannel;
    let step = 0;
    let find_flag = false;
    while ((tmp_sc = tmp_sc.get(sentinel)) !== void undefined && !find_flag) {
        // Where object last appeared in the ref tree
        const pos = tmp_sc.get(object);
        step += 1;
        if (typeof pos !== 'undefined') {
            if (pos === step) {
                throw new RangeError('Cyclic object value');
            }
            else {
                find_flag = true; // Break while
            }
        }
        if (typeof tmp_sc.get(sentinel) === 'undefined') {
            step = 0;
        }
    }
    if (typeof filter === 'function') {
        obj = filter(prefix, obj);
    }
    else if (obj instanceof Date) {
        obj = serializeDate?.(obj);
    }
    else if (generateArrayPrefix === 'comma' && is_array(obj)) {
        obj = (0, utils_1.maybe_map)(obj, function (value) {
            if (value instanceof Date) {
                return serializeDate?.(value);
            }
            return value;
        });
    }
    if (obj === null) {
        if (strictNullHandling) {
            return encoder && !encodeValuesOnly ?
                // @ts-expect-error
                encoder(prefix, defaults.encoder, charset, 'key', format)
                : prefix;
        }
        obj = '';
    }
    if (is_non_nullish_primitive(obj) || (0, utils_1.is_buffer)(obj)) {
        if (encoder) {
            const key_value = encodeValuesOnly ? prefix
                // @ts-expect-error
                : encoder(prefix, defaults.encoder, charset, 'key', format);
            return [
                formatter?.(key_value) +
                    '=' +
                    // @ts-expect-error
                    formatter?.(encoder(obj, defaults.encoder, charset, 'value', format)),
            ];
        }
        return [formatter?.(prefix) + '=' + formatter?.(String(obj))];
    }
    const values = [];
    if (typeof obj === 'undefined') {
        return values;
    }
    let obj_keys;
    if (generateArrayPrefix === 'comma' && is_array(obj)) {
        // we need to join elements in
        if (encodeValuesOnly && encoder) {
            // @ts-expect-error values only
            obj = (0, utils_1.maybe_map)(obj, encoder);
        }
        obj_keys = [{ value: obj.length > 0 ? obj.join(',') || null : void undefined }];
    }
    else if (is_array(filter)) {
        obj_keys = filter;
    }
    else {
        const keys = Object.keys(obj);
        obj_keys = sort ? keys.sort(sort) : keys;
    }
    const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, '%2E') : String(prefix);
    const adjusted_prefix = commaRoundTrip && is_array(obj) && obj.length === 1 ? encoded_prefix + '[]' : encoded_prefix;
    if (allowEmptyArrays && is_array(obj) && obj.length === 0) {
        return adjusted_prefix + '[]';
    }
    for (let j = 0; j < obj_keys.length; ++j) {
        const key = obj_keys[j];
        const value = 
        // @ts-ignore
        typeof key === 'object' && typeof key.value !== 'undefined' ? key.value : obj[key];
        if (skipNulls && value === null) {
            continue;
        }
        // @ts-ignore
        const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, '%2E') : key;
        const key_prefix = is_array(obj) ?
            typeof generateArrayPrefix === 'function' ?
                generateArrayPrefix(adjusted_prefix, encoded_key)
                : adjusted_prefix
            : adjusted_prefix + (allowDots ? '.' + encoded_key : '[' + encoded_key + ']');
        sideChannel.set(object, step);
        const valueSideChannel = new WeakMap();
        valueSideChannel.set(sentinel, sideChannel);
        push_to_array(values, inner_stringify(value, key_prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, 
        // @ts-ignore
        generateArrayPrefix === 'comma' && encodeValuesOnly && is_array(obj) ? null : encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, valueSideChannel));
    }
    return values;
}
function normalize_stringify_options(opts = defaults) {
    if (typeof opts.allowEmptyArrays !== 'undefined' && typeof opts.allowEmptyArrays !== 'boolean') {
        throw new TypeError('`allowEmptyArrays` option can only be `true` or `false`, when provided');
    }
    if (typeof opts.encodeDotInKeys !== 'undefined' && typeof opts.encodeDotInKeys !== 'boolean') {
        throw new TypeError('`encodeDotInKeys` option can only be `true` or `false`, when provided');
    }
    if (opts.encoder !== null && typeof opts.encoder !== 'undefined' && typeof opts.encoder !== 'function') {
        throw new TypeError('Encoder has to be a function.');
    }
    const charset = opts.charset || defaults.charset;
    if (typeof opts.charset !== 'undefined' && opts.charset !== 'utf-8' && opts.charset !== 'iso-8859-1') {
        throw new TypeError('The charset option must be either utf-8, iso-8859-1, or undefined');
    }
    let format = formats_1.default_format;
    if (typeof opts.format !== 'undefined') {
        if (!has.call(formats_1.formatters, opts.format)) {
            throw new TypeError('Unknown format option provided.');
        }
        format = opts.format;
    }
    const formatter = formats_1.formatters[format];
    let filter = defaults.filter;
    if (typeof opts.filter === 'function' || is_array(opts.filter)) {
        filter = opts.filter;
    }
    let arrayFormat;
    if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) {
        arrayFormat = opts.arrayFormat;
    }
    else if ('indices' in opts) {
        arrayFormat = opts.indices ? 'indices' : 'repeat';
    }
    else {
        arrayFormat = defaults.arrayFormat;
    }
    if ('commaRoundTrip' in opts && typeof opts.commaRoundTrip !== 'boolean') {
        throw new TypeError('`commaRoundTrip` must be a boolean, or absent');
    }
    const allowDots = typeof opts.allowDots === 'undefined' ?
        !!opts.encodeDotInKeys === true ?
            true
            : defaults.allowDots
        : !!opts.allowDots;
    return {
        addQueryPrefix: typeof opts.addQueryPrefix === 'boolean' ? opts.addQueryPrefix : defaults.addQueryPrefix,
        // @ts-ignore
        allowDots: allowDots,
        allowEmptyArrays: typeof opts.allowEmptyArrays === 'boolean' ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
        arrayFormat: arrayFormat,
        charset: charset,
        charsetSentinel: typeof opts.charsetSentinel === 'boolean' ? opts.charsetSentinel : defaults.charsetSentinel,
        commaRoundTrip: !!opts.commaRoundTrip,
        delimiter: typeof opts.delimiter === 'undefined' ? defaults.delimiter : opts.delimiter,
        encode: typeof opts.encode === 'boolean' ? opts.encode : defaults.encode,
        encodeDotInKeys: typeof opts.encodeDotInKeys === 'boolean' ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
        encoder: typeof opts.encoder === 'function' ? opts.encoder : defaults.encoder,
        encodeValuesOnly: typeof opts.encodeValuesOnly === 'boolean' ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
        filter: filter,
        format: format,
        formatter: formatter,
        serializeDate: typeof opts.serializeDate === 'function' ? opts.serializeDate : defaults.serializeDate,
        skipNulls: typeof opts.skipNulls === 'boolean' ? opts.skipNulls : defaults.skipNulls,
        // @ts-ignore
        sort: typeof opts.sort === 'function' ? opts.sort : null,
        strictNullHandling: typeof opts.strictNullHandling === 'boolean' ? opts.strictNullHandling : defaults.strictNullHandling,
    };
}
function stringify(object, opts = {}) {
    let obj = object;
    const options = normalize_stringify_options(opts);
    let obj_keys;
    let filter;
    if (typeof options.filter === 'function') {
        filter = options.filter;
        obj = filter('', obj);
    }
    else if (is_array(options.filter)) {
        filter = options.filter;
        obj_keys = filter;
    }
    const keys = [];
    if (typeof obj !== 'object' || obj === null) {
        return '';
    }
    const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
    const commaRoundTrip = generateArrayPrefix === 'comma' && options.commaRoundTrip;
    if (!obj_keys) {
        obj_keys = Object.keys(obj);
    }
    if (options.sort) {
        obj_keys.sort(options.sort);
    }
    const sideChannel = new WeakMap();
    for (let i = 0; i < obj_keys.length; ++i) {
        const key = obj_keys[i];
        if (options.skipNulls && obj[key] === null) {
            continue;
        }
        push_to_array(keys, inner_stringify(obj[key], key, 
        // @ts-expect-error
        generateArrayPrefix, commaRoundTrip, options.allowEmptyArrays, options.strictNullHandling, options.skipNulls, options.encodeDotInKeys, options.encode ? options.encoder : null, options.filter, options.sort, options.allowDots, options.serializeDate, options.format, options.formatter, options.encodeValuesOnly, options.charset, sideChannel));
    }
    const joined = keys.join(options.delimiter);
    let prefix = options.addQueryPrefix === true ? '?' : '';
    if (options.charsetSentinel) {
        if (options.charset === 'iso-8859-1') {
            // encodeURIComponent('&#10003;'), the "numeric entity" representation of a checkmark
            prefix += 'utf8=%26%2310003%3B&';
        }
        else {
            // encodeURIComponent('✓')
            prefix += 'utf8=%E2%9C%93&';
        }
    }
    return joined.length > 0 ? prefix + joined : '';
}

},{"./formats.js":20,"./utils.js":23}],23:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = void 0;
exports.merge = merge;
exports.assign_single_source = assign_single_source;
exports.decode = decode;
exports.compact = compact;
exports.is_regexp = is_regexp;
exports.is_buffer = is_buffer;
exports.combine = combine;
exports.maybe_map = maybe_map;
const formats_1 = require("./formats.js");
const has = Object.prototype.hasOwnProperty;
const is_array = Array.isArray;
const hex_table = (() => {
    const array = [];
    for (let i = 0; i < 256; ++i) {
        array.push('%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase());
    }
    return array;
})();
function compact_queue(queue) {
    while (queue.length > 1) {
        const item = queue.pop();
        if (!item)
            continue;
        const obj = item.obj[item.prop];
        if (is_array(obj)) {
            const compacted = [];
            for (let j = 0; j < obj.length; ++j) {
                if (typeof obj[j] !== 'undefined') {
                    compacted.push(obj[j]);
                }
            }
            // @ts-ignore
            item.obj[item.prop] = compacted;
        }
    }
}
function array_to_object(source, options) {
    const obj = options && options.plainObjects ? Object.create(null) : {};
    for (let i = 0; i < source.length; ++i) {
        if (typeof source[i] !== 'undefined') {
            obj[i] = source[i];
        }
    }
    return obj;
}
function merge(target, source, options = {}) {
    if (!source) {
        return target;
    }
    if (typeof source !== 'object') {
        if (is_array(target)) {
            target.push(source);
        }
        else if (target && typeof target === 'object') {
            if ((options && (options.plainObjects || options.allowPrototypes)) ||
                !has.call(Object.prototype, source)) {
                target[source] = true;
            }
        }
        else {
            return [target, source];
        }
        return target;
    }
    if (!target || typeof target !== 'object') {
        return [target].concat(source);
    }
    let mergeTarget = target;
    if (is_array(target) && !is_array(source)) {
        // @ts-ignore
        mergeTarget = array_to_object(target, options);
    }
    if (is_array(target) && is_array(source)) {
        source.forEach(function (item, i) {
            if (has.call(target, i)) {
                const targetItem = target[i];
                if (targetItem && typeof targetItem === 'object' && item && typeof item === 'object') {
                    target[i] = merge(targetItem, item, options);
                }
                else {
                    target.push(item);
                }
            }
            else {
                target[i] = item;
            }
        });
        return target;
    }
    return Object.keys(source).reduce(function (acc, key) {
        const value = source[key];
        if (has.call(acc, key)) {
            acc[key] = merge(acc[key], value, options);
        }
        else {
            acc[key] = value;
        }
        return acc;
    }, mergeTarget);
}
function assign_single_source(target, source) {
    return Object.keys(source).reduce(function (acc, key) {
        acc[key] = source[key];
        return acc;
    }, target);
}
function decode(str, _, charset) {
    const strWithoutPlus = str.replace(/\+/g, ' ');
    if (charset === 'iso-8859-1') {
        // unescape never throws, no try...catch needed:
        return strWithoutPlus.replace(/%[0-9a-f]{2}/gi, unescape);
    }
    // utf-8
    try {
        return decodeURIComponent(strWithoutPlus);
    }
    catch (e) {
        return strWithoutPlus;
    }
}
const limit = 1024;
const encode = (str, _defaultEncoder, charset, _kind, format) => {
    // This code was originally written by Brian White for the io.js core querystring library.
    // It has been adapted here for stricter adherence to RFC 3986
    if (str.length === 0) {
        return str;
    }
    let string = str;
    if (typeof str === 'symbol') {
        string = Symbol.prototype.toString.call(str);
    }
    else if (typeof str !== 'string') {
        string = String(str);
    }
    if (charset === 'iso-8859-1') {
        return escape(string).replace(/%u[0-9a-f]{4}/gi, function ($0) {
            return '%26%23' + parseInt($0.slice(2), 16) + '%3B';
        });
    }
    let out = '';
    for (let j = 0; j < string.length; j += limit) {
        const segment = string.length >= limit ? string.slice(j, j + limit) : string;
        const arr = [];
        for (let i = 0; i < segment.length; ++i) {
            let c = segment.charCodeAt(i);
            if (c === 0x2d || // -
                c === 0x2e || // .
                c === 0x5f || // _
                c === 0x7e || // ~
                (c >= 0x30 && c <= 0x39) || // 0-9
                (c >= 0x41 && c <= 0x5a) || // a-z
                (c >= 0x61 && c <= 0x7a) || // A-Z
                (format === formats_1.RFC1738 && (c === 0x28 || c === 0x29)) // ( )
            ) {
                arr[arr.length] = segment.charAt(i);
                continue;
            }
            if (c < 0x80) {
                arr[arr.length] = hex_table[c];
                continue;
            }
            if (c < 0x800) {
                arr[arr.length] = hex_table[0xc0 | (c >> 6)] + hex_table[0x80 | (c & 0x3f)];
                continue;
            }
            if (c < 0xd800 || c >= 0xe000) {
                arr[arr.length] =
                    hex_table[0xe0 | (c >> 12)] + hex_table[0x80 | ((c >> 6) & 0x3f)] + hex_table[0x80 | (c & 0x3f)];
                continue;
            }
            i += 1;
            c = 0x10000 + (((c & 0x3ff) << 10) | (segment.charCodeAt(i) & 0x3ff));
            arr[arr.length] =
                hex_table[0xf0 | (c >> 18)] +
                    hex_table[0x80 | ((c >> 12) & 0x3f)] +
                    hex_table[0x80 | ((c >> 6) & 0x3f)] +
                    hex_table[0x80 | (c & 0x3f)];
        }
        out += arr.join('');
    }
    return out;
};
exports.encode = encode;
function compact(value) {
    const queue = [{ obj: { o: value }, prop: 'o' }];
    const refs = [];
    for (let i = 0; i < queue.length; ++i) {
        const item = queue[i];
        // @ts-ignore
        const obj = item.obj[item.prop];
        const keys = Object.keys(obj);
        for (let j = 0; j < keys.length; ++j) {
            const key = keys[j];
            const val = obj[key];
            if (typeof val === 'object' && val !== null && refs.indexOf(val) === -1) {
                queue.push({ obj: obj, prop: key });
                refs.push(val);
            }
        }
    }
    compact_queue(queue);
    return value;
}
function is_regexp(obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
}
function is_buffer(obj) {
    if (!obj || typeof obj !== 'object') {
        return false;
    }
    return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function combine(a, b) {
    return [].concat(a, b);
}
function maybe_map(val, fn) {
    if (is_array(val)) {
        const mapped = [];
        for (let i = 0; i < val.length; i += 1) {
            mapped.push(fn(val[i]));
        }
        return mapped;
    }
    return fn(val);
}

},{"./formats.js":20}],24:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FallbackEncoder = void 0;
const FallbackEncoder = ({ headers, body }) => {
    return {
        bodyHeaders: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(body),
    };
};
exports.FallbackEncoder = FallbackEncoder;

},{}],25:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultFetch = getDefaultFetch;
exports.makeReadableStream = makeReadableStream;
exports.ReadableStreamFrom = ReadableStreamFrom;
exports.ReadableStreamToAsyncIterable = ReadableStreamToAsyncIterable;
exports.CancelReadableStream = CancelReadableStream;
function getDefaultFetch() {
    if (typeof fetch !== 'undefined') {
        return fetch;
    }
    throw new Error('`fetch` is not defined as a global; Either pass `fetch` to the client, `new OpenAI({ fetch })` or polyfill the global, `globalThis.fetch = fetch`');
}
function makeReadableStream(...args) {
    const ReadableStream = globalThis.ReadableStream;
    if (typeof ReadableStream === 'undefined') {
        // Note: All of the platforms / runtimes we officially support already define
        // `ReadableStream` as a global, so this should only ever be hit on unsupported runtimes.
        throw new Error('`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`');
    }
    return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
    let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
    return makeReadableStream({
        start() { },
        async pull(controller) {
            const { done, value } = await iter.next();
            if (done) {
                controller.close();
            }
            else {
                controller.enqueue(value);
            }
        },
        async cancel() {
            await iter.return?.();
        },
    });
}
/**
 * Most browsers don't yet have async iterable support for ReadableStream,
 * and Node has a very different way of reading bytes from its "ReadableStream".
 *
 * This polyfill was pulled from https://github.com/MattiasBuelens/web-streams-polyfill/pull/122#issuecomment-1627354490
 */
function ReadableStreamToAsyncIterable(stream) {
    if (stream[Symbol.asyncIterator])
        return stream;
    const reader = stream.getReader();
    return {
        async next() {
            try {
                const result = await reader.read();
                if (result?.done)
                    reader.releaseLock(); // release lock when stream becomes closed
                return result;
            }
            catch (e) {
                reader.releaseLock(); // release lock when stream becomes errored
                throw e;
            }
        },
        async return() {
            const cancelPromise = reader.cancel();
            reader.releaseLock();
            await cancelPromise;
            return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}
/**
 * Cancels a ReadableStream we don't need to consume.
 * See https://undici.nodejs.org/#/?id=garbage-collection
 */
async function CancelReadableStream(stream) {
    if (stream === null || typeof stream !== 'object')
        return;
    if (stream[Symbol.asyncIterator]) {
        await stream[Symbol.asyncIterator]().return?.();
        return;
    }
    const reader = stream.getReader();
    const cancelPromise = reader.cancel();
    reader.releaseLock();
    await cancelPromise;
}

},{}],26:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFile = toFile;
const uploads_1 = require("./uploads.js");
const uploads_2 = require("./uploads.js");
/**
 * This check adds the arrayBuffer() method type because it is available and used at runtime
 */
const isBlobLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.size === 'number' &&
    typeof value.type === 'string' &&
    typeof value.text === 'function' &&
    typeof value.slice === 'function' &&
    typeof value.arrayBuffer === 'function';
/**
 * This check adds the arrayBuffer() method type because it is available and used at runtime
 */
const isFileLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.name === 'string' &&
    typeof value.lastModified === 'number' &&
    isBlobLike(value);
const isResponseLike = (value) => value != null &&
    typeof value === 'object' &&
    typeof value.url === 'string' &&
    typeof value.blob === 'function';
/**
 * Helper for creating a {@link File} to pass to an SDK upload method from a variety of different data formats
 * @param value the raw content of the file.  Can be an {@link Uploadable}, {@link BlobLikePart}, or {@link AsyncIterable} of {@link BlobLikePart}s
 * @param {string=} name the name of the file. If omitted, toFile will try to determine a file name from bits if possible
 * @param {Object=} options additional properties
 * @param {string=} options.type the MIME type of the content
 * @param {number=} options.lastModified the last modified timestamp
 * @returns a {@link File} with the given properties
 */
async function toFile(value, name, options) {
    (0, uploads_2.checkFileSupport)();
    // If it's a promise, resolve it.
    value = await value;
    // If we've been given a `File` we don't need to do anything
    if (isFileLike(value)) {
        if (value instanceof File) {
            return value;
        }
        return (0, uploads_1.makeFile)([await value.arrayBuffer()], value.name);
    }
    if (isResponseLike(value)) {
        const blob = await value.blob();
        name || (name = new URL(value.url).pathname.split(/[\\/]/).pop());
        return (0, uploads_1.makeFile)(await getBytes(blob), name, options);
    }
    const parts = await getBytes(value);
    name || (name = (0, uploads_1.getName)(value));
    if (!options?.type) {
        const type = parts.find((part) => typeof part === 'object' && 'type' in part && part.type);
        if (typeof type === 'string') {
            options = { ...options, type };
        }
    }
    return (0, uploads_1.makeFile)(parts, name, options);
}
async function getBytes(value) {
    let parts = [];
    if (typeof value === 'string' ||
        ArrayBuffer.isView(value) || // includes Uint8Array, Buffer, etc.
        value instanceof ArrayBuffer) {
        parts.push(value);
    }
    else if (isBlobLike(value)) {
        parts.push(value instanceof Blob ? value : await value.arrayBuffer());
    }
    else if ((0, uploads_1.isAsyncIterable)(value) // includes Readable, ReadableStream, etc.
    ) {
        for await (const chunk of value) {
            parts.push(...(await getBytes(chunk))); // TODO, consider validating?
        }
    }
    else {
        const constructor = value?.constructor?.name;
        throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ''}${propsForError(value)}`);
    }
    return parts;
}
function propsForError(value) {
    if (typeof value !== 'object' || value === null)
        return '';
    const props = Object.getOwnPropertyNames(value);
    return `; props: [${props.map((p) => `"${p}"`).join(', ')}]`;
}

},{"./uploads.js":28}],27:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__setModuleDefault = exports.__createBinding = void 0;
exports.__classPrivateFieldSet = __classPrivateFieldSet;
exports.__classPrivateFieldGet = __classPrivateFieldGet;
exports.__exportStar = __exportStar;
exports.__importStar = __importStar;
function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m")
        throw new TypeError("Private method is not writable");
    if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? (f.value = value) : state.set(receiver, value), value;
}
function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
var __createBinding = Object.create
    ? function (o, m, k, k2) {
        if (k2 === void 0)
            k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = {
                enumerable: true,
                get: function () {
                    return m[k];
                },
            };
        }
        Object.defineProperty(o, k2, desc);
    }
    : function (o, m, k, k2) {
        if (k2 === void 0)
            k2 = k;
        o[k2] = m[k];
    };
exports.__createBinding = __createBinding;
function __exportStar(m, o) {
    for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
            __createBinding(o, m, p);
}
var __setModuleDefault = Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }
    : function (o, v) {
        o["default"] = v;
    };
exports.__setModuleDefault = __setModuleDefault;
var ownKeys = function (o) {
    ownKeys =
        Object.getOwnPropertyNames ||
            function (o2) {
                var ar = [];
                for (var k in o2)
                    if (Object.prototype.hasOwnProperty.call(o2, k))
                        ar[ar.length] = k;
                return ar;
            };
    return ownKeys(o);
};
function __importStar(mod) {
    if (mod && mod.__esModule)
        return mod;
    var result = {};
    if (mod != null) {
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
            if (k[i] !== "default")
                __createBinding(result, mod, k[i]);
    }
    __setModuleDefault(result, mod);
    return result;
}

},{}],28:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createForm = exports.multipartFormRequestOptions = exports.maybeMultipartFormRequestOptions = exports.isAsyncIterable = exports.checkFileSupport = void 0;
exports.makeFile = makeFile;
exports.getName = getName;
const shims_1 = require("./shims.js");
const checkFileSupport = () => {
    if (typeof File === 'undefined') {
        const { process } = globalThis;
        const isOldNode = typeof process?.versions?.node === 'string' && parseInt(process.versions.node.split('.')) < 20;
        throw new Error('`File` is not defined as a global, which is required for file uploads.' +
            (isOldNode ?
                " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`."
                : ''));
    }
};
exports.checkFileSupport = checkFileSupport;
/**
 * Construct a `File` instance. This is used to ensure a helpful error is thrown
 * for environments that don't define a global `File` yet.
 */
function makeFile(fileBits, fileName, options) {
    (0, exports.checkFileSupport)();
    return new File(fileBits, fileName ?? 'unknown_file', options);
}
function getName(value) {
    return (((typeof value === 'object' &&
        value !== null &&
        (('name' in value && value.name && String(value.name)) ||
            ('url' in value && value.url && String(value.url)) ||
            ('filename' in value && value.filename && String(value.filename)) ||
            ('path' in value && value.path && String(value.path)))) ||
        '')
        .split(/[\\/]/)
        .pop() || undefined);
}
const isAsyncIterable = (value) => value != null && typeof value === 'object' && typeof value[Symbol.asyncIterator] === 'function';
exports.isAsyncIterable = isAsyncIterable;
/**
 * Returns a multipart/form-data request if any part of the given request body contains a File / Blob value.
 * Otherwise returns the request as is.
 */
const maybeMultipartFormRequestOptions = async (opts, fetch) => {
    if (!hasUploadableValue(opts.body))
        return opts;
    return { ...opts, body: await (0, exports.createForm)(opts.body, fetch) };
};
exports.maybeMultipartFormRequestOptions = maybeMultipartFormRequestOptions;
const multipartFormRequestOptions = async (opts, fetch) => {
    return { ...opts, body: await (0, exports.createForm)(opts.body, fetch) };
};
exports.multipartFormRequestOptions = multipartFormRequestOptions;
const supportsFormDataMap = new WeakMap();
/**
 * node-fetch doesn't support the global FormData object in recent node versions. Instead of sending
 * properly-encoded form data, it just stringifies the object, resulting in a request body of "[object FormData]".
 * This function detects if the fetch function provided supports the global FormData object to avoid
 * confusing error messages later on.
 */
function supportsFormData(fetchObject) {
    const fetch = typeof fetchObject === 'function' ? fetchObject : fetchObject.fetch;
    const cached = supportsFormDataMap.get(fetch);
    if (cached)
        return cached;
    const promise = (async () => {
        try {
            const FetchResponse = ('Response' in fetch ?
                fetch.Response
                : (await fetch('data:,')).constructor);
            const data = new FormData();
            if (data.toString() === (await new FetchResponse(data).text())) {
                return false;
            }
            return true;
        }
        catch {
            // avoid false negatives
            return true;
        }
    })();
    supportsFormDataMap.set(fetch, promise);
    return promise;
}
const createForm = async (body, fetch) => {
    if (!(await supportsFormData(fetch))) {
        throw new TypeError('The provided fetch function does not support file uploads with the current global FormData class.');
    }
    const form = new FormData();
    await Promise.all(Object.entries(body || {}).map(([key, value]) => addFormValue(form, key, value)));
    return form;
};
exports.createForm = createForm;
// We check for Blob not File because Bun.File doesn't inherit from File,
// but they both inherit from Blob and have a `name` property at runtime.
const isNamedBlob = (value) => value instanceof Blob && 'name' in value;
const isUploadable = (value) => typeof value === 'object' &&
    value !== null &&
    (value instanceof Response || (0, exports.isAsyncIterable)(value) || isNamedBlob(value));
const hasUploadableValue = (value) => {
    if (isUploadable(value))
        return true;
    if (Array.isArray(value))
        return value.some(hasUploadableValue);
    if (value && typeof value === 'object') {
        for (const k in value) {
            if (hasUploadableValue(value[k]))
                return true;
        }
    }
    return false;
};
const addFormValue = async (form, key, value) => {
    if (value === undefined)
        return;
    if (value == null) {
        throw new TypeError(`Received null for "${key}"; to pass null in FormData, you must use the string 'null'`);
    }
    // TODO: make nested formats configurable
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        form.append(key, String(value));
    }
    else if (value instanceof Response) {
        form.append(key, makeFile([await value.blob()], getName(value)));
    }
    else if ((0, exports.isAsyncIterable)(value)) {
        form.append(key, makeFile([await new Response((0, shims_1.ReadableStreamFrom)(value)).blob()], getName(value)));
    }
    else if (isNamedBlob(value)) {
        form.append(key, value, getName(value));
    }
    else if (Array.isArray(value)) {
        await Promise.all(value.map((entry) => addFormValue(form, key + '[]', entry)));
    }
    else if (typeof value === 'object') {
        await Promise.all(Object.entries(value).map(([name, prop]) => addFormValue(form, `${key}[${name}]`, prop)));
    }
    else {
        throw new TypeError(`Invalid value given to form, expected a string, number, boolean, object, Array, File or Blob but got ${value} instead`);
    }
};

},{"./shims.js":25}],29:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("./tslib.js");
tslib_1.__exportStar(require("./utils/values.js"), exports);
tslib_1.__exportStar(require("./utils/base64.js"), exports);
tslib_1.__exportStar(require("./utils/env.js"), exports);
tslib_1.__exportStar(require("./utils/log.js"), exports);
tslib_1.__exportStar(require("./utils/uuid.js"), exports);
tslib_1.__exportStar(require("./utils/sleep.js"), exports);

},{"./tslib.js":27,"./utils/base64.js":30,"./utils/env.js":32,"./utils/log.js":33,"./utils/sleep.js":35,"./utils/uuid.js":36,"./utils/values.js":37}],30:[function(require,module,exports){
(function (Buffer){(function (){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFloat32Array = exports.fromBase64 = exports.toBase64 = void 0;
const error_1 = require("../../core/error.js");
const bytes_1 = require("./bytes.js");
const toBase64 = (data) => {
    if (!data)
        return '';
    if (typeof globalThis.Buffer !== 'undefined') {
        return globalThis.Buffer.from(data).toString('base64');
    }
    if (typeof data === 'string') {
        data = (0, bytes_1.encodeUTF8)(data);
    }
    if (typeof btoa !== 'undefined') {
        return btoa(String.fromCharCode.apply(null, data));
    }
    throw new error_1.OpenAIError('Cannot generate base64 string; Expected `Buffer` or `btoa` to be defined');
};
exports.toBase64 = toBase64;
const fromBase64 = (str) => {
    if (typeof globalThis.Buffer !== 'undefined') {
        const buf = globalThis.Buffer.from(str, 'base64');
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    if (typeof atob !== 'undefined') {
        const bstr = atob(str);
        const buf = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
            buf[i] = bstr.charCodeAt(i);
        }
        return buf;
    }
    throw new error_1.OpenAIError('Cannot decode base64 string; Expected `Buffer` or `atob` to be defined');
};
exports.fromBase64 = fromBase64;
/**
 * Converts a Base64 encoded string to a Float32Array.
 * @param base64Str - The Base64 encoded string.
 * @returns An Array of numbers interpreted as Float32 values.
 */
const toFloat32Array = (base64Str) => {
    if (typeof Buffer !== 'undefined') {
        // for Node.js environment
        const buf = Buffer.from(base64Str, 'base64');
        return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT));
    }
    else {
        // for legacy web platform APIs
        const binaryStr = atob(base64Str);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        return Array.from(new Float32Array(bytes.buffer));
    }
};
exports.toFloat32Array = toFloat32Array;

}).call(this)}).call(this,require("buffer").Buffer)
},{"../../core/error.js":8,"./bytes.js":31,"buffer":2}],31:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.concatBytes = concatBytes;
exports.encodeUTF8 = encodeUTF8;
exports.decodeUTF8 = decodeUTF8;
function concatBytes(buffers) {
    let length = 0;
    for (const buffer of buffers) {
        length += buffer.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const buffer of buffers) {
        output.set(buffer, index);
        index += buffer.length;
    }
    return output;
}
let encodeUTF8_;
function encodeUTF8(str) {
    let encoder;
    return (encodeUTF8_ ??
        ((encoder = new globalThis.TextEncoder()), (encodeUTF8_ = encoder.encode.bind(encoder))))(str);
}
let decodeUTF8_;
function decodeUTF8(bytes) {
    let decoder;
    return (decodeUTF8_ ??
        ((decoder = new globalThis.TextDecoder()), (decodeUTF8_ = decoder.decode.bind(decoder))))(bytes);
}

},{}],32:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.readEnv = void 0;
/**
 * Read an environment variable.
 *
 * Trims beginning and trailing whitespace.
 *
 * Will return undefined if the environment variable doesn't exist or cannot be accessed.
 */
const readEnv = (env) => {
    if (typeof globalThis.process !== 'undefined') {
        return globalThis.process.env?.[env]?.trim() ?? undefined;
    }
    if (typeof globalThis.Deno !== 'undefined') {
        return globalThis.Deno.env?.get?.(env)?.trim();
    }
    return undefined;
};
exports.readEnv = readEnv;

},{}],33:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRequestDetails = exports.parseLogLevel = void 0;
exports.loggerFor = loggerFor;
const values_1 = require("./values.js");
const levelNumbers = {
    off: 0,
    error: 200,
    warn: 300,
    info: 400,
    debug: 500,
};
const parseLogLevel = (maybeLevel, sourceName, client) => {
    if (!maybeLevel) {
        return undefined;
    }
    if ((0, values_1.hasOwn)(levelNumbers, maybeLevel)) {
        return maybeLevel;
    }
    loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
    return undefined;
};
exports.parseLogLevel = parseLogLevel;
function noop() { }
function makeLogFn(fnLevel, logger, logLevel) {
    if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) {
        return noop;
    }
    else {
        // Don't wrap logger functions, we want the stacktrace intact!
        return logger[fnLevel].bind(logger);
    }
}
const noopLogger = {
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
};
let cachedLoggers = new WeakMap();
function loggerFor(client) {
    const logger = client.logger;
    const logLevel = client.logLevel ?? 'off';
    if (!logger) {
        return noopLogger;
    }
    const cachedLogger = cachedLoggers.get(logger);
    if (cachedLogger && cachedLogger[0] === logLevel) {
        return cachedLogger[1];
    }
    const levelLogger = {
        error: makeLogFn('error', logger, logLevel),
        warn: makeLogFn('warn', logger, logLevel),
        info: makeLogFn('info', logger, logLevel),
        debug: makeLogFn('debug', logger, logLevel),
    };
    cachedLoggers.set(logger, [logLevel, levelLogger]);
    return levelLogger;
}
const formatRequestDetails = (details) => {
    if (details.options) {
        details.options = { ...details.options };
        delete details.options['headers']; // redundant + leaks internals
    }
    if (details.headers) {
        details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [
            name,
            (name.toLowerCase() === 'authorization' ||
                name.toLowerCase() === 'cookie' ||
                name.toLowerCase() === 'set-cookie') ?
                '***'
                : value,
        ]));
    }
    if ('retryOfRequestLogID' in details) {
        if (details.retryOfRequestLogID) {
            details.retryOf = details.retryOfRequestLogID;
        }
        delete details.retryOfRequestLogID;
    }
    return details;
};
exports.formatRequestDetails = formatRequestDetails;

},{"./values.js":37}],34:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.path = exports.createPathTagFunction = void 0;
exports.encodeURIPath = encodeURIPath;
const error_1 = require("../../core/error.js");
/**
 * Percent-encode everything that isn't safe to have in a path without encoding safe chars.
 *
 * Taken from https://datatracker.ietf.org/doc/html/rfc3986#section-3.3:
 * > unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
 * > sub-delims  = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
 * > pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
 */
function encodeURIPath(str) {
    return str.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const createPathTagFunction = (pathEncoder = encodeURIPath) => function path(statics, ...params) {
    // If there are no params, no processing is needed.
    if (statics.length === 1)
        return statics[0];
    let postPath = false;
    const path = statics.reduce((previousValue, currentValue, index) => {
        if (/[?#]/.test(currentValue)) {
            postPath = true;
        }
        return (previousValue +
            currentValue +
            (index === params.length ? '' : (postPath ? encodeURIComponent : pathEncoder)(String(params[index]))));
    }, '');
    const pathOnly = path.split(/[?#]/, 1)[0];
    const invalidSegments = [];
    const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
    let match;
    // Find all invalid segments
    while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) {
        invalidSegments.push({
            start: match.index,
            length: match[0].length,
        });
    }
    if (invalidSegments.length > 0) {
        let lastEnd = 0;
        const underline = invalidSegments.reduce((acc, segment) => {
            const spaces = ' '.repeat(segment.start - lastEnd);
            const arrows = '^'.repeat(segment.length);
            lastEnd = segment.start + segment.length;
            return acc + spaces + arrows;
        }, '');
        throw new error_1.OpenAIError(`Path parameters result in path with invalid segments:\n${path}\n${underline}`);
    }
    return path;
};
exports.createPathTagFunction = createPathTagFunction;
/**
 * URI-encodes path params and ensures no unsafe /./ or /../ path segments are introduced.
 */
exports.path = (0, exports.createPathTagFunction)(encodeURIPath);

},{"../../core/error.js":8}],35:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = void 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
exports.sleep = sleep;

},{}],36:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.uuid4 = void 0;
/**
 * https://stackoverflow.com/a/2117523
 */
let uuid4 = function () {
    const { crypto } = globalThis;
    if (crypto?.randomUUID) {
        exports.uuid4 = crypto.randomUUID.bind(crypto);
        return crypto.randomUUID();
    }
    const u8 = new Uint8Array(1);
    const randomByte = crypto ? () => crypto.getRandomValues(u8)[0] : () => (Math.random() * 0xff) & 0xff;
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (+c ^ (randomByte() & (15 >> (+c / 4)))).toString(16));
};
exports.uuid4 = uuid4;

},{}],37:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJSON = exports.maybeCoerceBoolean = exports.maybeCoerceFloat = exports.maybeCoerceInteger = exports.coerceBoolean = exports.coerceFloat = exports.coerceInteger = exports.validatePositiveInteger = exports.ensurePresent = exports.isAbsoluteURL = void 0;
exports.maybeObj = maybeObj;
exports.isEmptyObj = isEmptyObj;
exports.hasOwn = hasOwn;
exports.isObj = isObj;
const error_1 = require("../../core/error.js");
// https://url.spec.whatwg.org/#url-scheme-string
const startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
const isAbsoluteURL = (url) => {
    return startsWithSchemeRegexp.test(url);
};
exports.isAbsoluteURL = isAbsoluteURL;
/** Returns an object if the given value isn't an object, otherwise returns as-is */
function maybeObj(x) {
    if (typeof x !== 'object') {
        return {};
    }
    return x ?? {};
}
// https://stackoverflow.com/a/34491287
function isEmptyObj(obj) {
    if (!obj)
        return true;
    for (const _k in obj)
        return false;
    return true;
}
// https://eslint.org/docs/latest/rules/no-prototype-builtins
function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}
function isObj(obj) {
    return obj != null && typeof obj === 'object' && !Array.isArray(obj);
}
const ensurePresent = (value) => {
    if (value == null) {
        throw new error_1.OpenAIError(`Expected a value to be given but received ${value} instead.`);
    }
    return value;
};
exports.ensurePresent = ensurePresent;
const validatePositiveInteger = (name, n) => {
    if (typeof n !== 'number' || !Number.isInteger(n)) {
        throw new error_1.OpenAIError(`${name} must be an integer`);
    }
    if (n < 0) {
        throw new error_1.OpenAIError(`${name} must be a positive integer`);
    }
    return n;
};
exports.validatePositiveInteger = validatePositiveInteger;
const coerceInteger = (value) => {
    if (typeof value === 'number')
        return Math.round(value);
    if (typeof value === 'string')
        return parseInt(value, 10);
    throw new error_1.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
exports.coerceInteger = coerceInteger;
const coerceFloat = (value) => {
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string')
        return parseFloat(value);
    throw new error_1.OpenAIError(`Could not coerce ${value} (type: ${typeof value}) into a number`);
};
exports.coerceFloat = coerceFloat;
const coerceBoolean = (value) => {
    if (typeof value === 'boolean')
        return value;
    if (typeof value === 'string')
        return value === 'true';
    return Boolean(value);
};
exports.coerceBoolean = coerceBoolean;
const maybeCoerceInteger = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceInteger)(value);
};
exports.maybeCoerceInteger = maybeCoerceInteger;
const maybeCoerceFloat = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceFloat)(value);
};
exports.maybeCoerceFloat = maybeCoerceFloat;
const maybeCoerceBoolean = (value) => {
    if (value === undefined) {
        return undefined;
    }
    return (0, exports.coerceBoolean)(value);
};
exports.maybeCoerceBoolean = maybeCoerceBoolean;
const safeJSON = (text) => {
    try {
        return JSON.parse(text);
    }
    catch (err) {
        return undefined;
    }
};
exports.safeJSON = safeJSON;

},{"../../core/error.js":8}],38:[function(require,module,exports){
"use strict";
var _AbstractChatCompletionRunner_instances, _AbstractChatCompletionRunner_getFinalContent, _AbstractChatCompletionRunner_getFinalMessage, _AbstractChatCompletionRunner_getFinalFunctionToolCall, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult, _AbstractChatCompletionRunner_calculateTotalUsage, _AbstractChatCompletionRunner_validateParams, _AbstractChatCompletionRunner_stringifyFunctionCallResult;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractChatCompletionRunner = void 0;
const tslib_1 = require("../internal/tslib.js");
const error_1 = require("../error.js");
const RunnableFunction_1 = require("./RunnableFunction.js");
const chatCompletionUtils_1 = require("./chatCompletionUtils.js");
const EventStream_1 = require("./EventStream.js");
const parser_1 = require("../lib/parser.js");
const DEFAULT_MAX_CHAT_COMPLETIONS = 10;
class AbstractChatCompletionRunner extends EventStream_1.EventStream {
    constructor() {
        super(...arguments);
        _AbstractChatCompletionRunner_instances.add(this);
        this._chatCompletions = [];
        this.messages = [];
    }
    _addChatCompletion(chatCompletion) {
        this._chatCompletions.push(chatCompletion);
        this._emit('chatCompletion', chatCompletion);
        const message = chatCompletion.choices[0]?.message;
        if (message)
            this._addMessage(message);
        return chatCompletion;
    }
    _addMessage(message, emit = true) {
        if (!('content' in message))
            message.content = null;
        this.messages.push(message);
        if (emit) {
            this._emit('message', message);
            if ((0, chatCompletionUtils_1.isToolMessage)(message) && message.content) {
                // Note, this assumes that {role: 'tool', content: …} is always the result of a call of tool of type=function.
                this._emit('functionToolCallResult', message.content);
            }
            else if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message.tool_calls) {
                for (const tool_call of message.tool_calls) {
                    if (tool_call.type === 'function') {
                        this._emit('functionToolCall', tool_call.function);
                    }
                }
            }
        }
    }
    /**
     * @returns a promise that resolves with the final ChatCompletion, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletion.
     */
    async finalChatCompletion() {
        await this.done();
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (!completion)
            throw new error_1.OpenAIError('stream ended without producing a ChatCompletion');
        return completion;
    }
    /**
     * @returns a promise that resolves with the content of the final ChatCompletionMessage, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalContent() {
        await this.done();
        return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
    }
    /**
     * @returns a promise that resolves with the the final assistant ChatCompletionMessage response,
     * or rejects if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalMessage() {
        await this.done();
        return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
    }
    /**
     * @returns a promise that resolves with the content of the final FunctionCall, or rejects
     * if an error occurred or the stream ended prematurely without producing a ChatCompletionMessage.
     */
    async finalFunctionToolCall() {
        await this.done();
        return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
    }
    async finalFunctionToolCallResult() {
        await this.done();
        return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
    }
    async totalUsage() {
        await this.done();
        return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this);
    }
    allChatCompletions() {
        return [...this._chatCompletions];
    }
    _emitFinal() {
        const completion = this._chatCompletions[this._chatCompletions.length - 1];
        if (completion)
            this._emit('finalChatCompletion', completion);
        const finalMessage = tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this);
        if (finalMessage)
            this._emit('finalMessage', finalMessage);
        const finalContent = tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalContent).call(this);
        if (finalContent)
            this._emit('finalContent', finalContent);
        const finalFunctionCall = tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCall).call(this);
        if (finalFunctionCall)
            this._emit('finalFunctionToolCall', finalFunctionCall);
        const finalFunctionCallResult = tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalFunctionToolCallResult).call(this);
        if (finalFunctionCallResult != null)
            this._emit('finalFunctionToolCallResult', finalFunctionCallResult);
        if (this._chatCompletions.some((c) => c.usage)) {
            this._emit('totalUsage', tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_calculateTotalUsage).call(this));
        }
    }
    async _createChatCompletion(client, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_validateParams).call(this, params);
        const chatCompletion = await client.chat.completions.create({ ...params, stream: false }, { ...options, signal: this.controller.signal });
        this._connected();
        return this._addChatCompletion((0, parser_1.parseChatCompletion)(chatCompletion, params));
    }
    async _runChatCompletion(client, params, options) {
        for (const message of params.messages) {
            this._addMessage(message, false);
        }
        return await this._createChatCompletion(client, params, options);
    }
    async _runTools(client, params, options) {
        const role = 'tool';
        const { tool_choice = 'auto', stream, ...restParams } = params;
        const singleFunctionToCall = typeof tool_choice !== 'string' && tool_choice?.function?.name;
        const { maxChatCompletions = DEFAULT_MAX_CHAT_COMPLETIONS } = options || {};
        // TODO(someday): clean this logic up
        const inputTools = params.tools.map((tool) => {
            if ((0, parser_1.isAutoParsableTool)(tool)) {
                if (!tool.$callback) {
                    throw new error_1.OpenAIError('Tool given to `.runTools()` that does not have an associated function');
                }
                return {
                    type: 'function',
                    function: {
                        function: tool.$callback,
                        name: tool.function.name,
                        description: tool.function.description || '',
                        parameters: tool.function.parameters,
                        parse: tool.$parseRaw,
                        strict: true,
                    },
                };
            }
            return tool;
        });
        const functionsByName = {};
        for (const f of inputTools) {
            if (f.type === 'function') {
                functionsByName[f.function.name || f.function.function.name] = f.function;
            }
        }
        const tools = 'tools' in params ?
            inputTools.map((t) => t.type === 'function' ?
                {
                    type: 'function',
                    function: {
                        name: t.function.name || t.function.function.name,
                        parameters: t.function.parameters,
                        description: t.function.description,
                        strict: t.function.strict,
                    },
                }
                : t)
            : undefined;
        for (const message of params.messages) {
            this._addMessage(message, false);
        }
        for (let i = 0; i < maxChatCompletions; ++i) {
            const chatCompletion = await this._createChatCompletion(client, {
                ...restParams,
                tool_choice,
                tools,
                messages: [...this.messages],
            }, options);
            const message = chatCompletion.choices[0]?.message;
            if (!message) {
                throw new error_1.OpenAIError(`missing message in ChatCompletion response`);
            }
            if (!message.tool_calls?.length) {
                return;
            }
            for (const tool_call of message.tool_calls) {
                if (tool_call.type !== 'function')
                    continue;
                const tool_call_id = tool_call.id;
                const { name, arguments: args } = tool_call.function;
                const fn = functionsByName[name];
                if (!fn) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. Available options are: ${Object.keys(functionsByName)
                        .map((name) => JSON.stringify(name))
                        .join(', ')}. Please try again`;
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                else if (singleFunctionToCall && singleFunctionToCall !== name) {
                    const content = `Invalid tool_call: ${JSON.stringify(name)}. ${JSON.stringify(singleFunctionToCall)} requested. Please try again`;
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                let parsed;
                try {
                    parsed = (0, RunnableFunction_1.isRunnableFunctionWithParse)(fn) ? await fn.parse(args) : args;
                }
                catch (error) {
                    const content = error instanceof Error ? error.message : String(error);
                    this._addMessage({ role, tool_call_id, content });
                    continue;
                }
                // @ts-expect-error it can't rule out `never` type.
                const rawContent = await fn.function(parsed, this);
                const content = tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_stringifyFunctionCallResult).call(this, rawContent);
                this._addMessage({ role, tool_call_id, content });
                if (singleFunctionToCall) {
                    return;
                }
            }
        }
        return;
    }
}
exports.AbstractChatCompletionRunner = AbstractChatCompletionRunner;
_AbstractChatCompletionRunner_instances = new WeakSet(), _AbstractChatCompletionRunner_getFinalContent = function _AbstractChatCompletionRunner_getFinalContent() {
    return tslib_1.__classPrivateFieldGet(this, _AbstractChatCompletionRunner_instances, "m", _AbstractChatCompletionRunner_getFinalMessage).call(this).content ?? null;
}, _AbstractChatCompletionRunner_getFinalMessage = function _AbstractChatCompletionRunner_getFinalMessage() {
    let i = this.messages.length;
    while (i-- > 0) {
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message)) {
            // TODO: support audio here
            const ret = {
                ...message,
                content: message.content ?? null,
                refusal: message.refusal ?? null,
            };
            return ret;
        }
    }
    throw new error_1.OpenAIError('stream ended without producing a ChatCompletionMessage with role=assistant');
}, _AbstractChatCompletionRunner_getFinalFunctionToolCall = function _AbstractChatCompletionRunner_getFinalFunctionToolCall() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message?.tool_calls?.length) {
            return message.tool_calls.at(-1)?.function;
        }
    }
    return;
}, _AbstractChatCompletionRunner_getFinalFunctionToolCallResult = function _AbstractChatCompletionRunner_getFinalFunctionToolCallResult() {
    for (let i = this.messages.length - 1; i >= 0; i--) {
        const message = this.messages[i];
        if ((0, chatCompletionUtils_1.isToolMessage)(message) &&
            message.content != null &&
            typeof message.content === 'string' &&
            this.messages.some((x) => x.role === 'assistant' &&
                x.tool_calls?.some((y) => y.type === 'function' && y.id === message.tool_call_id))) {
            return message.content;
        }
    }
    return;
}, _AbstractChatCompletionRunner_calculateTotalUsage = function _AbstractChatCompletionRunner_calculateTotalUsage() {
    const total = {
        completion_tokens: 0,
        prompt_tokens: 0,
        total_tokens: 0,
    };
    for (const { usage } of this._chatCompletions) {
        if (usage) {
            total.completion_tokens += usage.completion_tokens;
            total.prompt_tokens += usage.prompt_tokens;
            total.total_tokens += usage.total_tokens;
        }
    }
    return total;
}, _AbstractChatCompletionRunner_validateParams = function _AbstractChatCompletionRunner_validateParams(params) {
    if (params.n != null && params.n > 1) {
        throw new error_1.OpenAIError('ChatCompletion convenience helpers only support n=1 at this time. To use n>1, please use chat.completions.create() directly.');
    }
}, _AbstractChatCompletionRunner_stringifyFunctionCallResult = function _AbstractChatCompletionRunner_stringifyFunctionCallResult(rawContent) {
    return (typeof rawContent === 'string' ? rawContent
        : rawContent === undefined ? 'undefined'
            : JSON.stringify(rawContent));
};

},{"../error.js":13,"../internal/tslib.js":27,"../lib/parser.js":48,"./EventStream.js":43,"./RunnableFunction.js":45,"./chatCompletionUtils.js":47}],39:[function(require,module,exports){
"use strict";
var _AssistantStream_instances, _a, _AssistantStream_events, _AssistantStream_runStepSnapshots, _AssistantStream_messageSnapshots, _AssistantStream_messageSnapshot, _AssistantStream_finalRun, _AssistantStream_currentContentIndex, _AssistantStream_currentContent, _AssistantStream_currentToolCallIndex, _AssistantStream_currentToolCall, _AssistantStream_currentEvent, _AssistantStream_currentRunSnapshot, _AssistantStream_currentRunStepSnapshot, _AssistantStream_addEvent, _AssistantStream_endRequest, _AssistantStream_handleMessage, _AssistantStream_handleRunStep, _AssistantStream_handleEvent, _AssistantStream_accumulateRunStep, _AssistantStream_accumulateMessage, _AssistantStream_accumulateContent, _AssistantStream_handleRun;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantStream = void 0;
const tslib_1 = require("../internal/tslib.js");
const streaming_1 = require("../streaming.js");
const error_1 = require("../error.js");
const EventStream_1 = require("./EventStream.js");
const utils_1 = require("../internal/utils.js");
class AssistantStream extends EventStream_1.EventStream {
    constructor() {
        super(...arguments);
        _AssistantStream_instances.add(this);
        //Track all events in a single list for reference
        _AssistantStream_events.set(this, []);
        //Used to accumulate deltas
        //We are accumulating many types so the value here is not strict
        _AssistantStream_runStepSnapshots.set(this, {});
        _AssistantStream_messageSnapshots.set(this, {});
        _AssistantStream_messageSnapshot.set(this, void 0);
        _AssistantStream_finalRun.set(this, void 0);
        _AssistantStream_currentContentIndex.set(this, void 0);
        _AssistantStream_currentContent.set(this, void 0);
        _AssistantStream_currentToolCallIndex.set(this, void 0);
        _AssistantStream_currentToolCall.set(this, void 0);
        //For current snapshot methods
        _AssistantStream_currentEvent.set(this, void 0);
        _AssistantStream_currentRunSnapshot.set(this, void 0);
        _AssistantStream_currentRunStepSnapshot.set(this, void 0);
    }
    [(_AssistantStream_events = new WeakMap(), _AssistantStream_runStepSnapshots = new WeakMap(), _AssistantStream_messageSnapshots = new WeakMap(), _AssistantStream_messageSnapshot = new WeakMap(), _AssistantStream_finalRun = new WeakMap(), _AssistantStream_currentContentIndex = new WeakMap(), _AssistantStream_currentContent = new WeakMap(), _AssistantStream_currentToolCallIndex = new WeakMap(), _AssistantStream_currentToolCall = new WeakMap(), _AssistantStream_currentEvent = new WeakMap(), _AssistantStream_currentRunSnapshot = new WeakMap(), _AssistantStream_currentRunStepSnapshot = new WeakMap(), _AssistantStream_instances = new WeakSet(), Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        //Catch all for passing along all events
        this.on('event', (event) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(event);
            }
            else {
                pushQueue.push(event);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk) => (chunk ? { value: chunk, done: false } : { value: undefined, done: true }));
                }
                const chunk = pushQueue.shift();
                return { value: chunk, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    static fromReadableStream(stream) {
        const runner = new _a();
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        this._connected();
        const stream = streaming_1.Stream.fromReadableStream(readableStream, this.controller);
        for await (const event of stream) {
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    toReadableStream() {
        const stream = new streaming_1.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
    static createToolAssistantStream(runId, runs, params, options) {
        const runner = new _a();
        runner._run(() => runner._runToolAssistantStream(runId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    async _createToolAssistantStream(run, runId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.submitToolOutputs(runId, body, {
            ...options,
            signal: this.controller.signal,
        });
        this._connected();
        for await (const event of stream) {
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static createThreadAssistantStream(params, thread, options) {
        const runner = new _a();
        runner._run(() => runner._threadAssistantStream(params, thread, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    static createAssistantStream(threadId, runs, params, options) {
        const runner = new _a();
        runner._run(() => runner._runAssistantStream(threadId, runs, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    currentEvent() {
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentEvent, "f");
    }
    currentRun() {
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentRunSnapshot, "f");
    }
    currentMessageSnapshot() {
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f");
    }
    currentRunStepSnapshot() {
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentRunStepSnapshot, "f");
    }
    async finalRunSteps() {
        await this.done();
        return Object.values(tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f"));
    }
    async finalMessages() {
        await this.done();
        return Object.values(tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f"));
    }
    async finalRun() {
        await this.done();
        if (!tslib_1.__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
            throw Error('Final run was not received.');
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
    }
    async _createThreadAssistantStream(thread, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await thread.createAndRun(body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    async _createAssistantStream(run, threadId, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        const body = { ...params, stream: true };
        const stream = await run.create(threadId, body, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const event of stream) {
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_addEvent).call(this, event);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addRun(tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_endRequest).call(this));
    }
    static accumulateDelta(acc, delta) {
        for (const [key, deltaValue] of Object.entries(delta)) {
            if (!acc.hasOwnProperty(key)) {
                acc[key] = deltaValue;
                continue;
            }
            let accValue = acc[key];
            if (accValue === null || accValue === undefined) {
                acc[key] = deltaValue;
                continue;
            }
            // We don't accumulate these special properties
            if (key === 'index' || key === 'type') {
                acc[key] = deltaValue;
                continue;
            }
            // Type-specific accumulation logic
            if (typeof accValue === 'string' && typeof deltaValue === 'string') {
                accValue += deltaValue;
            }
            else if (typeof accValue === 'number' && typeof deltaValue === 'number') {
                accValue += deltaValue;
            }
            else if ((0, utils_1.isObj)(accValue) && (0, utils_1.isObj)(deltaValue)) {
                accValue = this.accumulateDelta(accValue, deltaValue);
            }
            else if (Array.isArray(accValue) && Array.isArray(deltaValue)) {
                if (accValue.every((x) => typeof x === 'string' || typeof x === 'number')) {
                    accValue.push(...deltaValue); // Use spread syntax for efficient addition
                    continue;
                }
                for (const deltaEntry of deltaValue) {
                    if (!(0, utils_1.isObj)(deltaEntry)) {
                        throw new Error(`Expected array delta entry to be an object but got: ${deltaEntry}`);
                    }
                    const index = deltaEntry['index'];
                    if (index == null) {
                        console.error(deltaEntry);
                        throw new Error('Expected array delta entry to have an `index` property');
                    }
                    if (typeof index !== 'number') {
                        throw new Error(`Expected array delta entry \`index\` property to be a number but got ${index}`);
                    }
                    const accEntry = accValue[index];
                    if (accEntry == null) {
                        accValue.push(deltaEntry);
                    }
                    else {
                        accValue[index] = this.accumulateDelta(accEntry, deltaEntry);
                    }
                }
                continue;
            }
            else {
                throw Error(`Unhandled record type: ${key}, deltaValue: ${deltaValue}, accValue: ${accValue}`);
            }
            acc[key] = accValue;
        }
        return acc;
    }
    _addRun(run) {
        return run;
    }
    async _threadAssistantStream(params, thread, options) {
        return await this._createThreadAssistantStream(thread, params, options);
    }
    async _runAssistantStream(threadId, runs, params, options) {
        return await this._createAssistantStream(runs, threadId, params, options);
    }
    async _runToolAssistantStream(runId, runs, params, options) {
        return await this._createToolAssistantStream(runs, runId, params, options);
    }
}
exports.AssistantStream = AssistantStream;
_a = AssistantStream, _AssistantStream_addEvent = function _AssistantStream_addEvent(event) {
    if (this.ended)
        return;
    tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentEvent, event, "f");
    tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleEvent).call(this, event);
    switch (event.event) {
        case 'thread.created':
            //No action on this event.
            break;
        case 'thread.run.created':
        case 'thread.run.queued':
        case 'thread.run.in_progress':
        case 'thread.run.requires_action':
        case 'thread.run.completed':
        case 'thread.run.incomplete':
        case 'thread.run.failed':
        case 'thread.run.cancelling':
        case 'thread.run.cancelled':
        case 'thread.run.expired':
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRun).call(this, event);
            break;
        case 'thread.run.step.created':
        case 'thread.run.step.in_progress':
        case 'thread.run.step.delta':
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleRunStep).call(this, event);
            break;
        case 'thread.message.created':
        case 'thread.message.in_progress':
        case 'thread.message.delta':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_handleMessage).call(this, event);
            break;
        case 'error':
            //This is included for completeness, but errors are processed in the SSE event processing so this should not occur
            throw new Error('Encountered an error event in event processing - errors should be processed earlier');
        default:
            assertNever(event);
    }
}, _AssistantStream_endRequest = function _AssistantStream_endRequest() {
    if (this.ended) {
        throw new error_1.OpenAIError(`stream has ended, this shouldn't happen`);
    }
    if (!tslib_1.__classPrivateFieldGet(this, _AssistantStream_finalRun, "f"))
        throw Error('Final run has not been received');
    return tslib_1.__classPrivateFieldGet(this, _AssistantStream_finalRun, "f");
}, _AssistantStream_handleMessage = function _AssistantStream_handleMessage(event) {
    const [accumulatedMessage, newContent] = tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateMessage).call(this, event, tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
    tslib_1.__classPrivateFieldSet(this, _AssistantStream_messageSnapshot, accumulatedMessage, "f");
    tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshots, "f")[accumulatedMessage.id] = accumulatedMessage;
    for (const content of newContent) {
        const snapshotContent = accumulatedMessage.content[content.index];
        if (snapshotContent?.type == 'text') {
            this._emit('textCreated', snapshotContent.text);
        }
    }
    switch (event.event) {
        case 'thread.message.created':
            this._emit('messageCreated', event.data);
            break;
        case 'thread.message.in_progress':
            break;
        case 'thread.message.delta':
            this._emit('messageDelta', event.data.delta, accumulatedMessage);
            if (event.data.delta.content) {
                for (const content of event.data.delta.content) {
                    //If it is text delta, emit a text delta event
                    if (content.type == 'text' && content.text) {
                        let textDelta = content.text;
                        let snapshot = accumulatedMessage.content[content.index];
                        if (snapshot && snapshot.type == 'text') {
                            this._emit('textDelta', textDelta, snapshot.text);
                        }
                        else {
                            throw Error('The snapshot associated with this text delta is not text or missing');
                        }
                    }
                    if (content.index != tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")) {
                        //See if we have in progress content
                        if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContent, "f")) {
                            switch (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").type) {
                                case 'text':
                                    this._emit('textDone', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").text, tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                                case 'image_file':
                                    this._emit('imageFileDone', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContent, "f").image_file, tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                                    break;
                            }
                        }
                        tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentContentIndex, content.index, "f");
                    }
                    tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentContent, accumulatedMessage.content[content.index], "f");
                }
            }
            break;
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //We emit the latest content we were working on on completion (including incomplete)
            if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f") !== undefined) {
                const currentContent = event.data.content[tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentContentIndex, "f")];
                if (currentContent) {
                    switch (currentContent.type) {
                        case 'image_file':
                            this._emit('imageFileDone', currentContent.image_file, tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                        case 'text':
                            this._emit('textDone', currentContent.text, tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f"));
                            break;
                    }
                }
            }
            if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_messageSnapshot, "f")) {
                this._emit('messageDone', event.data);
            }
            tslib_1.__classPrivateFieldSet(this, _AssistantStream_messageSnapshot, undefined, "f");
    }
}, _AssistantStream_handleRunStep = function _AssistantStream_handleRunStep(event) {
    const accumulatedRunStep = tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateRunStep).call(this, event);
    tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, accumulatedRunStep, "f");
    switch (event.event) {
        case 'thread.run.step.created':
            this._emit('runStepCreated', event.data);
            break;
        case 'thread.run.step.delta':
            const delta = event.data.delta;
            if (delta.step_details &&
                delta.step_details.type == 'tool_calls' &&
                delta.step_details.tool_calls &&
                accumulatedRunStep.step_details.type == 'tool_calls') {
                for (const toolCall of delta.step_details.tool_calls) {
                    if (toolCall.index == tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCallIndex, "f")) {
                        this._emit('toolCallDelta', toolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index]);
                    }
                    else {
                        if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                            this._emit('toolCallDone', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                        }
                        tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentToolCallIndex, toolCall.index, "f");
                        tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentToolCall, accumulatedRunStep.step_details.tool_calls[toolCall.index], "f");
                        if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"))
                            this._emit('toolCallCreated', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    }
                }
            }
            this._emit('runStepDelta', event.data.delta, accumulatedRunStep);
            break;
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
            tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentRunStepSnapshot, undefined, "f");
            const details = event.data.step_details;
            if (details.type == 'tool_calls') {
                if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                    this._emit('toolCallDone', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                    tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
                }
            }
            this._emit('runStepDone', event.data, accumulatedRunStep);
            break;
        case 'thread.run.step.in_progress':
            break;
    }
}, _AssistantStream_handleEvent = function _AssistantStream_handleEvent(event) {
    tslib_1.__classPrivateFieldGet(this, _AssistantStream_events, "f").push(event);
    this._emit('event', event);
}, _AssistantStream_accumulateRunStep = function _AssistantStream_accumulateRunStep(event) {
    switch (event.event) {
        case 'thread.run.step.created':
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            return event.data;
        case 'thread.run.step.delta':
            let snapshot = tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
            if (!snapshot) {
                throw Error('Received a RunStepDelta before creation of a snapshot');
            }
            let data = event.data;
            if (data.delta) {
                const accumulated = _a.accumulateDelta(snapshot, data.delta);
                tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = accumulated;
            }
            return tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
        case 'thread.run.step.completed':
        case 'thread.run.step.failed':
        case 'thread.run.step.cancelled':
        case 'thread.run.step.expired':
        case 'thread.run.step.in_progress':
            tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id] = event.data;
            break;
    }
    if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id])
        return tslib_1.__classPrivateFieldGet(this, _AssistantStream_runStepSnapshots, "f")[event.data.id];
    throw new Error('No snapshot available');
}, _AssistantStream_accumulateMessage = function _AssistantStream_accumulateMessage(event, snapshot) {
    let newContent = [];
    switch (event.event) {
        case 'thread.message.created':
            //On creation the snapshot is just the initial message
            return [event.data, newContent];
        case 'thread.message.delta':
            if (!snapshot) {
                throw Error('Received a delta with no existing snapshot (there should be one from message creation)');
            }
            let data = event.data;
            //If this delta does not have content, nothing to process
            if (data.delta.content) {
                for (const contentElement of data.delta.content) {
                    if (contentElement.index in snapshot.content) {
                        let currentContent = snapshot.content[contentElement.index];
                        snapshot.content[contentElement.index] = tslib_1.__classPrivateFieldGet(this, _AssistantStream_instances, "m", _AssistantStream_accumulateContent).call(this, contentElement, currentContent);
                    }
                    else {
                        snapshot.content[contentElement.index] = contentElement;
                        // This is a new element
                        newContent.push(contentElement);
                    }
                }
            }
            return [snapshot, newContent];
        case 'thread.message.in_progress':
        case 'thread.message.completed':
        case 'thread.message.incomplete':
            //No changes on other thread events
            if (snapshot) {
                return [snapshot, newContent];
            }
            else {
                throw Error('Received thread message event with no existing snapshot');
            }
    }
    throw Error('Tried to accumulate a non-message event');
}, _AssistantStream_accumulateContent = function _AssistantStream_accumulateContent(contentElement, currentContent) {
    return _a.accumulateDelta(currentContent, contentElement);
}, _AssistantStream_handleRun = function _AssistantStream_handleRun(event) {
    tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentRunSnapshot, event.data, "f");
    switch (event.event) {
        case 'thread.run.created':
            break;
        case 'thread.run.queued':
            break;
        case 'thread.run.in_progress':
            break;
        case 'thread.run.requires_action':
        case 'thread.run.cancelled':
        case 'thread.run.failed':
        case 'thread.run.completed':
        case 'thread.run.expired':
        case 'thread.run.incomplete':
            tslib_1.__classPrivateFieldSet(this, _AssistantStream_finalRun, event.data, "f");
            if (tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f")) {
                this._emit('toolCallDone', tslib_1.__classPrivateFieldGet(this, _AssistantStream_currentToolCall, "f"));
                tslib_1.__classPrivateFieldSet(this, _AssistantStream_currentToolCall, undefined, "f");
            }
            break;
        case 'thread.run.cancelling':
            break;
    }
};
function assertNever(_x) { }

},{"../error.js":13,"../internal/tslib.js":27,"../internal/utils.js":29,"../streaming.js":100,"./EventStream.js":43}],40:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionRunner = void 0;
const AbstractChatCompletionRunner_1 = require("./AbstractChatCompletionRunner.js");
const chatCompletionUtils_1 = require("./chatCompletionUtils.js");
class ChatCompletionRunner extends AbstractChatCompletionRunner_1.AbstractChatCompletionRunner {
    static runTools(client, params, options) {
        const runner = new ChatCompletionRunner();
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runTools' },
        };
        runner._run(() => runner._runTools(client, params, opts));
        return runner;
    }
    _addMessage(message, emit = true) {
        super._addMessage(message, emit);
        if ((0, chatCompletionUtils_1.isAssistantMessage)(message) && message.content) {
            this._emit('content', message.content);
        }
    }
}
exports.ChatCompletionRunner = ChatCompletionRunner;

},{"./AbstractChatCompletionRunner.js":38,"./chatCompletionUtils.js":47}],41:[function(require,module,exports){
"use strict";
var _ChatCompletionStream_instances, _ChatCompletionStream_params, _ChatCompletionStream_choiceEventStates, _ChatCompletionStream_currentChatCompletionSnapshot, _ChatCompletionStream_beginRequest, _ChatCompletionStream_getChoiceEventState, _ChatCompletionStream_addChunk, _ChatCompletionStream_emitToolCallDoneEvent, _ChatCompletionStream_emitContentDoneEvents, _ChatCompletionStream_endRequest, _ChatCompletionStream_getAutoParseableResponseFormat, _ChatCompletionStream_accumulateChatCompletion;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionStream = void 0;
const tslib_1 = require("../internal/tslib.js");
const error_1 = require("../error.js");
const AbstractChatCompletionRunner_1 = require("./AbstractChatCompletionRunner.js");
const streaming_1 = require("../streaming.js");
const parser_1 = require("../lib/parser.js");
const parser_2 = require("../_vendor/partial-json-parser/parser.js");
class ChatCompletionStream extends AbstractChatCompletionRunner_1.AbstractChatCompletionRunner {
    constructor(params) {
        super();
        _ChatCompletionStream_instances.add(this);
        _ChatCompletionStream_params.set(this, void 0);
        _ChatCompletionStream_choiceEventStates.set(this, void 0);
        _ChatCompletionStream_currentChatCompletionSnapshot.set(this, void 0);
        tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_params, params, "f");
        tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
    }
    get currentChatCompletionSnapshot() {
        return tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
    }
    /**
     * Intended for use on the frontend, consuming a stream produced with
     * `.toReadableStream()` on the backend.
     *
     * Note that messages sent to the model do not appear in `.on('message')`
     * in this context.
     */
    static fromReadableStream(stream) {
        const runner = new ChatCompletionStream(null);
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    static createChatCompletion(client, params, options) {
        const runner = new ChatCompletionStream(params);
        runner._run(() => runner._runChatCompletion(client, { ...params, stream: true }, { ...options, headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' } }));
        return runner;
    }
    async _createChatCompletion(client, params, options) {
        super._createChatCompletion;
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        const stream = await client.chat.completions.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
        this._connected();
        for await (const chunk of stream) {
            tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addChatCompletion(tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    async _fromReadableStream(readableStream, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_beginRequest).call(this);
        this._connected();
        const stream = streaming_1.Stream.fromReadableStream(readableStream, this.controller);
        let chatId;
        for await (const chunk of stream) {
            if (chatId && chatId !== chunk.id) {
                // A new request has been made.
                this._addChatCompletion(tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
            }
            tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_addChunk).call(this, chunk);
            chatId = chunk.id;
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return this._addChatCompletion(tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_endRequest).call(this));
    }
    [(_ChatCompletionStream_params = new WeakMap(), _ChatCompletionStream_choiceEventStates = new WeakMap(), _ChatCompletionStream_currentChatCompletionSnapshot = new WeakMap(), _ChatCompletionStream_instances = new WeakSet(), _ChatCompletionStream_beginRequest = function _ChatCompletionStream_beginRequest() {
        if (this.ended)
            return;
        tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
    }, _ChatCompletionStream_getChoiceEventState = function _ChatCompletionStream_getChoiceEventState(choice) {
        let state = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index];
        if (state) {
            return state;
        }
        state = {
            content_done: false,
            refusal_done: false,
            logprobs_content_done: false,
            logprobs_refusal_done: false,
            done_tool_calls: new Set(),
            current_tool_call_index: null,
        };
        tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_choiceEventStates, "f")[choice.index] = state;
        return state;
    }, _ChatCompletionStream_addChunk = function _ChatCompletionStream_addChunk(chunk) {
        if (this.ended)
            return;
        const completion = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_accumulateChatCompletion).call(this, chunk);
        this._emit('chunk', chunk, completion);
        for (const choice of chunk.choices) {
            const choiceSnapshot = completion.choices[choice.index];
            if (choice.delta.content != null &&
                choiceSnapshot.message?.role === 'assistant' &&
                choiceSnapshot.message?.content) {
                this._emit('content', choice.delta.content, choiceSnapshot.message.content);
                this._emit('content.delta', {
                    delta: choice.delta.content,
                    snapshot: choiceSnapshot.message.content,
                    parsed: choiceSnapshot.message.parsed,
                });
            }
            if (choice.delta.refusal != null &&
                choiceSnapshot.message?.role === 'assistant' &&
                choiceSnapshot.message?.refusal) {
                this._emit('refusal.delta', {
                    delta: choice.delta.refusal,
                    snapshot: choiceSnapshot.message.refusal,
                });
            }
            if (choice.logprobs?.content != null && choiceSnapshot.message?.role === 'assistant') {
                this._emit('logprobs.content.delta', {
                    content: choice.logprobs?.content,
                    snapshot: choiceSnapshot.logprobs?.content ?? [],
                });
            }
            if (choice.logprobs?.refusal != null && choiceSnapshot.message?.role === 'assistant') {
                this._emit('logprobs.refusal.delta', {
                    refusal: choice.logprobs?.refusal,
                    snapshot: choiceSnapshot.logprobs?.refusal ?? [],
                });
            }
            const state = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
            if (choiceSnapshot.finish_reason) {
                tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
                if (state.current_tool_call_index != null) {
                    tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
                }
            }
            for (const toolCall of choice.delta.tool_calls ?? []) {
                if (state.current_tool_call_index !== toolCall.index) {
                    tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitContentDoneEvents).call(this, choiceSnapshot);
                    // new tool call started, the previous one is done
                    if (state.current_tool_call_index != null) {
                        tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_emitToolCallDoneEvent).call(this, choiceSnapshot, state.current_tool_call_index);
                    }
                }
                state.current_tool_call_index = toolCall.index;
            }
            for (const toolCallDelta of choice.delta.tool_calls ?? []) {
                const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallDelta.index];
                if (!toolCallSnapshot?.type) {
                    continue;
                }
                if (toolCallSnapshot?.type === 'function') {
                    this._emit('tool_calls.function.arguments.delta', {
                        name: toolCallSnapshot.function?.name,
                        index: toolCallDelta.index,
                        arguments: toolCallSnapshot.function.arguments,
                        parsed_arguments: toolCallSnapshot.function.parsed_arguments,
                        arguments_delta: toolCallDelta.function?.arguments ?? '',
                    });
                }
                else {
                    assertNever(toolCallSnapshot?.type);
                }
            }
        }
    }, _ChatCompletionStream_emitToolCallDoneEvent = function _ChatCompletionStream_emitToolCallDoneEvent(choiceSnapshot, toolCallIndex) {
        const state = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
        if (state.done_tool_calls.has(toolCallIndex)) {
            // we've already fired the done event
            return;
        }
        const toolCallSnapshot = choiceSnapshot.message.tool_calls?.[toolCallIndex];
        if (!toolCallSnapshot) {
            throw new Error('no tool call snapshot');
        }
        if (!toolCallSnapshot.type) {
            throw new Error('tool call snapshot missing `type`');
        }
        if (toolCallSnapshot.type === 'function') {
            const inputTool = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.tools?.find((tool) => tool.type === 'function' && tool.function.name === toolCallSnapshot.function.name);
            this._emit('tool_calls.function.arguments.done', {
                name: toolCallSnapshot.function.name,
                index: toolCallIndex,
                arguments: toolCallSnapshot.function.arguments,
                parsed_arguments: (0, parser_1.isAutoParsableTool)(inputTool) ? inputTool.$parseRaw(toolCallSnapshot.function.arguments)
                    : inputTool?.function.strict ? JSON.parse(toolCallSnapshot.function.arguments)
                        : null,
            });
        }
        else {
            assertNever(toolCallSnapshot.type);
        }
    }, _ChatCompletionStream_emitContentDoneEvents = function _ChatCompletionStream_emitContentDoneEvents(choiceSnapshot) {
        const state = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getChoiceEventState).call(this, choiceSnapshot);
        if (choiceSnapshot.message.content && !state.content_done) {
            state.content_done = true;
            const responseFormat = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this);
            this._emit('content.done', {
                content: choiceSnapshot.message.content,
                parsed: responseFormat ? responseFormat.$parseRaw(choiceSnapshot.message.content) : null,
            });
        }
        if (choiceSnapshot.message.refusal && !state.refusal_done) {
            state.refusal_done = true;
            this._emit('refusal.done', { refusal: choiceSnapshot.message.refusal });
        }
        if (choiceSnapshot.logprobs?.content && !state.logprobs_content_done) {
            state.logprobs_content_done = true;
            this._emit('logprobs.content.done', { content: choiceSnapshot.logprobs.content });
        }
        if (choiceSnapshot.logprobs?.refusal && !state.logprobs_refusal_done) {
            state.logprobs_refusal_done = true;
            this._emit('logprobs.refusal.done', { refusal: choiceSnapshot.logprobs.refusal });
        }
    }, _ChatCompletionStream_endRequest = function _ChatCompletionStream_endRequest() {
        if (this.ended) {
            throw new error_1.OpenAIError(`stream has ended, this shouldn't happen`);
        }
        const snapshot = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        if (!snapshot) {
            throw new error_1.OpenAIError(`request ended without sending any chunks`);
        }
        tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, undefined, "f");
        tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_choiceEventStates, [], "f");
        return finalizeChatCompletion(snapshot, tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"));
    }, _ChatCompletionStream_getAutoParseableResponseFormat = function _ChatCompletionStream_getAutoParseableResponseFormat() {
        const responseFormat = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f")?.response_format;
        if ((0, parser_1.isAutoParsableResponseFormat)(responseFormat)) {
            return responseFormat;
        }
        return null;
    }, _ChatCompletionStream_accumulateChatCompletion = function _ChatCompletionStream_accumulateChatCompletion(chunk) {
        var _a, _b, _c, _d;
        let snapshot = tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_currentChatCompletionSnapshot, "f");
        const { choices, ...rest } = chunk;
        if (!snapshot) {
            snapshot = tslib_1.__classPrivateFieldSet(this, _ChatCompletionStream_currentChatCompletionSnapshot, {
                ...rest,
                choices: [],
            }, "f");
        }
        else {
            Object.assign(snapshot, rest);
        }
        for (const { delta, finish_reason, index, logprobs = null, ...other } of chunk.choices) {
            let choice = snapshot.choices[index];
            if (!choice) {
                choice = snapshot.choices[index] = { finish_reason, index, message: {}, logprobs, ...other };
            }
            if (logprobs) {
                if (!choice.logprobs) {
                    choice.logprobs = Object.assign({}, logprobs);
                }
                else {
                    const { content, refusal, ...rest } = logprobs;
                    assertIsEmpty(rest);
                    Object.assign(choice.logprobs, rest);
                    if (content) {
                        (_a = choice.logprobs).content ?? (_a.content = []);
                        choice.logprobs.content.push(...content);
                    }
                    if (refusal) {
                        (_b = choice.logprobs).refusal ?? (_b.refusal = []);
                        choice.logprobs.refusal.push(...refusal);
                    }
                }
            }
            if (finish_reason) {
                choice.finish_reason = finish_reason;
                if (tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f") && (0, parser_1.hasAutoParseableInput)(tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"))) {
                    if (finish_reason === 'length') {
                        throw new error_1.LengthFinishReasonError();
                    }
                    if (finish_reason === 'content_filter') {
                        throw new error_1.ContentFilterFinishReasonError();
                    }
                }
            }
            Object.assign(choice, other);
            if (!delta)
                continue; // Shouldn't happen; just in case.
            const { content, refusal, function_call, role, tool_calls, ...rest } = delta;
            assertIsEmpty(rest);
            Object.assign(choice.message, rest);
            if (refusal) {
                choice.message.refusal = (choice.message.refusal || '') + refusal;
            }
            if (role)
                choice.message.role = role;
            if (function_call) {
                if (!choice.message.function_call) {
                    choice.message.function_call = function_call;
                }
                else {
                    if (function_call.name)
                        choice.message.function_call.name = function_call.name;
                    if (function_call.arguments) {
                        (_c = choice.message.function_call).arguments ?? (_c.arguments = '');
                        choice.message.function_call.arguments += function_call.arguments;
                    }
                }
            }
            if (content) {
                choice.message.content = (choice.message.content || '') + content;
                if (!choice.message.refusal && tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_instances, "m", _ChatCompletionStream_getAutoParseableResponseFormat).call(this)) {
                    choice.message.parsed = (0, parser_2.partialParse)(choice.message.content);
                }
            }
            if (tool_calls) {
                if (!choice.message.tool_calls)
                    choice.message.tool_calls = [];
                for (const { index, id, type, function: fn, ...rest } of tool_calls) {
                    const tool_call = ((_d = choice.message.tool_calls)[index] ?? (_d[index] = {}));
                    Object.assign(tool_call, rest);
                    if (id)
                        tool_call.id = id;
                    if (type)
                        tool_call.type = type;
                    if (fn)
                        tool_call.function ?? (tool_call.function = { name: fn.name ?? '', arguments: '' });
                    if (fn?.name)
                        tool_call.function.name = fn.name;
                    if (fn?.arguments) {
                        tool_call.function.arguments += fn.arguments;
                        if ((0, parser_1.shouldParseToolCall)(tslib_1.__classPrivateFieldGet(this, _ChatCompletionStream_params, "f"), tool_call)) {
                            tool_call.function.parsed_arguments = (0, parser_2.partialParse)(tool_call.function.arguments);
                        }
                    }
                }
            }
        }
        return snapshot;
    }, Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        this.on('chunk', (chunk) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(chunk);
            }
            else {
                pushQueue.push(chunk);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((chunk) => (chunk ? { value: chunk, done: false } : { value: undefined, done: true }));
                }
                const chunk = pushQueue.shift();
                return { value: chunk, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    toReadableStream() {
        const stream = new streaming_1.Stream(this[Symbol.asyncIterator].bind(this), this.controller);
        return stream.toReadableStream();
    }
}
exports.ChatCompletionStream = ChatCompletionStream;
function finalizeChatCompletion(snapshot, params) {
    const { id, choices, created, model, system_fingerprint, ...rest } = snapshot;
    const completion = {
        ...rest,
        id,
        choices: choices.map(({ message, finish_reason, index, logprobs, ...choiceRest }) => {
            if (!finish_reason) {
                throw new error_1.OpenAIError(`missing finish_reason for choice ${index}`);
            }
            const { content = null, function_call, tool_calls, ...messageRest } = message;
            const role = message.role; // this is what we expect; in theory it could be different which would make our types a slight lie but would be fine.
            if (!role) {
                throw new error_1.OpenAIError(`missing role for choice ${index}`);
            }
            if (function_call) {
                const { arguments: args, name } = function_call;
                if (args == null) {
                    throw new error_1.OpenAIError(`missing function_call.arguments for choice ${index}`);
                }
                if (!name) {
                    throw new error_1.OpenAIError(`missing function_call.name for choice ${index}`);
                }
                return {
                    ...choiceRest,
                    message: {
                        content,
                        function_call: { arguments: args, name },
                        role,
                        refusal: message.refusal ?? null,
                    },
                    finish_reason,
                    index,
                    logprobs,
                };
            }
            if (tool_calls) {
                return {
                    ...choiceRest,
                    index,
                    finish_reason,
                    logprobs,
                    message: {
                        ...messageRest,
                        role,
                        content,
                        refusal: message.refusal ?? null,
                        tool_calls: tool_calls.map((tool_call, i) => {
                            const { function: fn, type, id, ...toolRest } = tool_call;
                            const { arguments: args, name, ...fnRest } = fn || {};
                            if (id == null) {
                                throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].id\n${str(snapshot)}`);
                            }
                            if (type == null) {
                                throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].type\n${str(snapshot)}`);
                            }
                            if (name == null) {
                                throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.name\n${str(snapshot)}`);
                            }
                            if (args == null) {
                                throw new error_1.OpenAIError(`missing choices[${index}].tool_calls[${i}].function.arguments\n${str(snapshot)}`);
                            }
                            return { ...toolRest, id, type, function: { ...fnRest, name, arguments: args } };
                        }),
                    },
                };
            }
            return {
                ...choiceRest,
                message: { ...messageRest, content, role, refusal: message.refusal ?? null },
                finish_reason,
                index,
                logprobs,
            };
        }),
        created,
        model,
        object: 'chat.completion',
        ...(system_fingerprint ? { system_fingerprint } : {}),
    };
    return (0, parser_1.maybeParseChatCompletion)(completion, params);
}
function str(x) {
    return JSON.stringify(x);
}
/**
 * Ensures the given argument is an empty object, useful for
 * asserting that all known properties on an object have been
 * destructured.
 */
function assertIsEmpty(obj) {
    return;
}
function assertNever(_x) { }

},{"../_vendor/partial-json-parser/parser.js":4,"../error.js":13,"../internal/tslib.js":27,"../lib/parser.js":48,"../streaming.js":100,"./AbstractChatCompletionRunner.js":38}],42:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionStreamingRunner = void 0;
const ChatCompletionStream_1 = require("./ChatCompletionStream.js");
class ChatCompletionStreamingRunner extends ChatCompletionStream_1.ChatCompletionStream {
    static fromReadableStream(stream) {
        const runner = new ChatCompletionStreamingRunner(null);
        runner._run(() => runner._fromReadableStream(stream));
        return runner;
    }
    static runTools(client, params, options) {
        const runner = new ChatCompletionStreamingRunner(
        // @ts-expect-error TODO these types are incompatible
        params);
        const opts = {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'runTools' },
        };
        runner._run(() => runner._runTools(client, params, opts));
        return runner;
    }
}
exports.ChatCompletionStreamingRunner = ChatCompletionStreamingRunner;

},{"./ChatCompletionStream.js":41}],43:[function(require,module,exports){
"use strict";
var _EventStream_instances, _EventStream_connectedPromise, _EventStream_resolveConnectedPromise, _EventStream_rejectConnectedPromise, _EventStream_endPromise, _EventStream_resolveEndPromise, _EventStream_rejectEndPromise, _EventStream_listeners, _EventStream_ended, _EventStream_errored, _EventStream_aborted, _EventStream_catchingPromiseCreated, _EventStream_handleError;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventStream = void 0;
const tslib_1 = require("../internal/tslib.js");
const error_1 = require("../error.js");
class EventStream {
    constructor() {
        _EventStream_instances.add(this);
        this.controller = new AbortController();
        _EventStream_connectedPromise.set(this, void 0);
        _EventStream_resolveConnectedPromise.set(this, () => { });
        _EventStream_rejectConnectedPromise.set(this, () => { });
        _EventStream_endPromise.set(this, void 0);
        _EventStream_resolveEndPromise.set(this, () => { });
        _EventStream_rejectEndPromise.set(this, () => { });
        _EventStream_listeners.set(this, {});
        _EventStream_ended.set(this, false);
        _EventStream_errored.set(this, false);
        _EventStream_aborted.set(this, false);
        _EventStream_catchingPromiseCreated.set(this, false);
        tslib_1.__classPrivateFieldSet(this, _EventStream_connectedPromise, new Promise((resolve, reject) => {
            tslib_1.__classPrivateFieldSet(this, _EventStream_resolveConnectedPromise, resolve, "f");
            tslib_1.__classPrivateFieldSet(this, _EventStream_rejectConnectedPromise, reject, "f");
        }), "f");
        tslib_1.__classPrivateFieldSet(this, _EventStream_endPromise, new Promise((resolve, reject) => {
            tslib_1.__classPrivateFieldSet(this, _EventStream_resolveEndPromise, resolve, "f");
            tslib_1.__classPrivateFieldSet(this, _EventStream_rejectEndPromise, reject, "f");
        }), "f");
        // Don't let these promises cause unhandled rejection errors.
        // we will manually cause an unhandled rejection error later
        // if the user hasn't registered any error listener or called
        // any promise-returning method.
        tslib_1.__classPrivateFieldGet(this, _EventStream_connectedPromise, "f").catch(() => { });
        tslib_1.__classPrivateFieldGet(this, _EventStream_endPromise, "f").catch(() => { });
    }
    _run(executor) {
        // Unfortunately if we call `executor()` immediately we get runtime errors about
        // references to `this` before the `super()` constructor call returns.
        setTimeout(() => {
            executor().then(() => {
                this._emitFinal();
                this._emit('end');
            }, tslib_1.__classPrivateFieldGet(this, _EventStream_instances, "m", _EventStream_handleError).bind(this));
        }, 0);
    }
    _connected() {
        if (this.ended)
            return;
        tslib_1.__classPrivateFieldGet(this, _EventStream_resolveConnectedPromise, "f").call(this);
        this._emit('connect');
    }
    get ended() {
        return tslib_1.__classPrivateFieldGet(this, _EventStream_ended, "f");
    }
    get errored() {
        return tslib_1.__classPrivateFieldGet(this, _EventStream_errored, "f");
    }
    get aborted() {
        return tslib_1.__classPrivateFieldGet(this, _EventStream_aborted, "f");
    }
    abort() {
        this.controller.abort();
    }
    /**
     * Adds the listener function to the end of the listeners array for the event.
     * No checks are made to see if the listener has already been added. Multiple calls passing
     * the same combination of event and listener will result in the listener being added, and
     * called, multiple times.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    on(event, listener) {
        const listeners = tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
        listeners.push({ listener });
        return this;
    }
    /**
     * Removes the specified listener from the listener array for the event.
     * off() will remove, at most, one instance of a listener from the listener array. If any single
     * listener has been added multiple times to the listener array for the specified event, then
     * off() must be called multiple times to remove each instance.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    off(event, listener) {
        const listeners = tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
        if (!listeners)
            return this;
        const index = listeners.findIndex((l) => l.listener === listener);
        if (index >= 0)
            listeners.splice(index, 1);
        return this;
    }
    /**
     * Adds a one-time listener function for the event. The next time the event is triggered,
     * this listener is removed and then invoked.
     * @returns this ChatCompletionStream, so that calls can be chained
     */
    once(event, listener) {
        const listeners = tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] || (tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = []);
        listeners.push({ listener, once: true });
        return this;
    }
    /**
     * This is similar to `.once()`, but returns a Promise that resolves the next time
     * the event is triggered, instead of calling a listener callback.
     * @returns a Promise that resolves the next time given event is triggered,
     * or rejects if an error is emitted.  (If you request the 'error' event,
     * returns a promise that resolves with the error).
     *
     * Example:
     *
     *   const message = await stream.emitted('message') // rejects if the stream errors
     */
    emitted(event) {
        return new Promise((resolve, reject) => {
            tslib_1.__classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
            if (event !== 'error')
                this.once('error', reject);
            this.once(event, resolve);
        });
    }
    async done() {
        tslib_1.__classPrivateFieldSet(this, _EventStream_catchingPromiseCreated, true, "f");
        await tslib_1.__classPrivateFieldGet(this, _EventStream_endPromise, "f");
    }
    _emit(event, ...args) {
        // make sure we don't emit any events after end
        if (tslib_1.__classPrivateFieldGet(this, _EventStream_ended, "f")) {
            return;
        }
        if (event === 'end') {
            tslib_1.__classPrivateFieldSet(this, _EventStream_ended, true, "f");
            tslib_1.__classPrivateFieldGet(this, _EventStream_resolveEndPromise, "f").call(this);
        }
        const listeners = tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event];
        if (listeners) {
            tslib_1.__classPrivateFieldGet(this, _EventStream_listeners, "f")[event] = listeners.filter((l) => !l.once);
            listeners.forEach(({ listener }) => listener(...args));
        }
        if (event === 'abort') {
            const error = args[0];
            if (!tslib_1.__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
                Promise.reject(error);
            }
            tslib_1.__classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
            tslib_1.__classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
            this._emit('end');
            return;
        }
        if (event === 'error') {
            // NOTE: _emit('error', error) should only be called from #handleError().
            const error = args[0];
            if (!tslib_1.__classPrivateFieldGet(this, _EventStream_catchingPromiseCreated, "f") && !listeners?.length) {
                // Trigger an unhandled rejection if the user hasn't registered any error handlers.
                // If you are seeing stack traces here, make sure to handle errors via either:
                // - runner.on('error', () => ...)
                // - await runner.done()
                // - await runner.finalChatCompletion()
                // - etc.
                Promise.reject(error);
            }
            tslib_1.__classPrivateFieldGet(this, _EventStream_rejectConnectedPromise, "f").call(this, error);
            tslib_1.__classPrivateFieldGet(this, _EventStream_rejectEndPromise, "f").call(this, error);
            this._emit('end');
        }
    }
    _emitFinal() { }
}
exports.EventStream = EventStream;
_EventStream_connectedPromise = new WeakMap(), _EventStream_resolveConnectedPromise = new WeakMap(), _EventStream_rejectConnectedPromise = new WeakMap(), _EventStream_endPromise = new WeakMap(), _EventStream_resolveEndPromise = new WeakMap(), _EventStream_rejectEndPromise = new WeakMap(), _EventStream_listeners = new WeakMap(), _EventStream_ended = new WeakMap(), _EventStream_errored = new WeakMap(), _EventStream_aborted = new WeakMap(), _EventStream_catchingPromiseCreated = new WeakMap(), _EventStream_instances = new WeakSet(), _EventStream_handleError = function _EventStream_handleError(error) {
    tslib_1.__classPrivateFieldSet(this, _EventStream_errored, true, "f");
    if (error instanceof Error && error.name === 'AbortError') {
        error = new error_1.APIUserAbortError();
    }
    if (error instanceof error_1.APIUserAbortError) {
        tslib_1.__classPrivateFieldSet(this, _EventStream_aborted, true, "f");
        return this._emit('abort', error);
    }
    if (error instanceof error_1.OpenAIError) {
        return this._emit('error', error);
    }
    if (error instanceof Error) {
        const openAIError = new error_1.OpenAIError(error.message);
        // @ts-ignore
        openAIError.cause = error;
        return this._emit('error', openAIError);
    }
    return this._emit('error', new error_1.OpenAIError(String(error)));
};

},{"../error.js":13,"../internal/tslib.js":27}],44:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeParseResponse = maybeParseResponse;
exports.parseResponse = parseResponse;
exports.hasAutoParseableInput = hasAutoParseableInput;
exports.makeParseableResponseTool = makeParseableResponseTool;
exports.isAutoParsableTool = isAutoParsableTool;
exports.shouldParseToolCall = shouldParseToolCall;
exports.validateInputTools = validateInputTools;
exports.addOutputText = addOutputText;
const error_1 = require("../error.js");
const parser_1 = require("../lib/parser.js");
function maybeParseResponse(response, params) {
    if (!params || !hasAutoParseableInput(params)) {
        return {
            ...response,
            output_parsed: null,
            output: response.output.map((item) => {
                if (item.type === 'function_call') {
                    return {
                        ...item,
                        parsed_arguments: null,
                    };
                }
                if (item.type === 'message') {
                    return {
                        ...item,
                        content: item.content.map((content) => ({
                            ...content,
                            parsed: null,
                        })),
                    };
                }
                else {
                    return item;
                }
            }),
        };
    }
    return parseResponse(response, params);
}
function parseResponse(response, params) {
    const output = response.output.map((item) => {
        if (item.type === 'function_call') {
            return {
                ...item,
                parsed_arguments: parseToolCall(params, item),
            };
        }
        if (item.type === 'message') {
            const content = item.content.map((content) => {
                if (content.type === 'output_text') {
                    return {
                        ...content,
                        parsed: parseTextFormat(params, content.text),
                    };
                }
                return content;
            });
            return {
                ...item,
                content,
            };
        }
        return item;
    });
    const parsed = Object.assign({}, response, { output });
    if (!Object.getOwnPropertyDescriptor(response, 'output_text')) {
        addOutputText(parsed);
    }
    Object.defineProperty(parsed, 'output_parsed', {
        enumerable: true,
        get() {
            for (const output of parsed.output) {
                if (output.type !== 'message') {
                    continue;
                }
                for (const content of output.content) {
                    if (content.type === 'output_text' && content.parsed !== null) {
                        return content.parsed;
                    }
                }
            }
            return null;
        },
    });
    return parsed;
}
function parseTextFormat(params, content) {
    if (params.text?.format?.type !== 'json_schema') {
        return null;
    }
    if ('$parseRaw' in params.text?.format) {
        const text_format = params.text?.format;
        return text_format.$parseRaw(content);
    }
    return JSON.parse(content);
}
function hasAutoParseableInput(params) {
    if ((0, parser_1.isAutoParsableResponseFormat)(params.text?.format)) {
        return true;
    }
    return false;
}
function makeParseableResponseTool(tool, { parser, callback, }) {
    const obj = { ...tool };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-tool',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
        $callback: {
            value: callback,
            enumerable: false,
        },
    });
    return obj;
}
function isAutoParsableTool(tool) {
    return tool?.['$brand'] === 'auto-parseable-tool';
}
function getInputToolByName(input_tools, name) {
    return input_tools.find((tool) => tool.type === 'function' && tool.name === name);
}
function parseToolCall(params, toolCall) {
    const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
    return {
        ...toolCall,
        ...toolCall,
        parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.arguments)
            : inputTool?.strict ? JSON.parse(toolCall.arguments)
                : null,
    };
}
function shouldParseToolCall(params, toolCall) {
    if (!params) {
        return false;
    }
    const inputTool = getInputToolByName(params.tools ?? [], toolCall.name);
    return isAutoParsableTool(inputTool) || inputTool?.strict || false;
}
function validateInputTools(tools) {
    for (const tool of tools ?? []) {
        if (tool.type !== 'function') {
            throw new error_1.OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
        }
        if (tool.function.strict !== true) {
            throw new error_1.OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
        }
    }
}
function addOutputText(rsp) {
    const texts = [];
    for (const output of rsp.output) {
        if (output.type !== 'message') {
            continue;
        }
        for (const content of output.content) {
            if (content.type === 'output_text') {
                texts.push(content.text);
            }
        }
    }
    rsp.output_text = texts.join('');
}

},{"../error.js":13,"../lib/parser.js":48}],45:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParsingToolFunction = void 0;
exports.isRunnableFunctionWithParse = isRunnableFunctionWithParse;
function isRunnableFunctionWithParse(fn) {
    return typeof fn.parse === 'function';
}
/**
 * This is helper class for passing a `function` and `parse` where the `function`
 * argument type matches the `parse` return type.
 */
class ParsingToolFunction {
    constructor(input) {
        this.type = 'function';
        this.function = input;
    }
}
exports.ParsingToolFunction = ParsingToolFunction;

},{}],46:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allSettledWithThrow = void 0;
/**
 * Like `Promise.allSettled()` but throws an error if any promises are rejected.
 */
const allSettledWithThrow = async (promises) => {
    const results = await Promise.allSettled(promises);
    const rejected = results.filter((result) => result.status === 'rejected');
    if (rejected.length) {
        for (const result of rejected) {
            console.error(result.reason);
        }
        throw new Error(`${rejected.length} promise(s) failed - see the above errors`);
    }
    // Note: TS was complaining about using `.filter().map()` here for some reason
    const values = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            values.push(result.value);
        }
    }
    return values;
};
exports.allSettledWithThrow = allSettledWithThrow;

},{}],47:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isToolMessage = exports.isAssistantMessage = void 0;
exports.isPresent = isPresent;
const isAssistantMessage = (message) => {
    return message?.role === 'assistant';
};
exports.isAssistantMessage = isAssistantMessage;
const isToolMessage = (message) => {
    return message?.role === 'tool';
};
exports.isToolMessage = isToolMessage;
function isPresent(obj) {
    return obj != null;
}

},{}],48:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeParseableResponseFormat = makeParseableResponseFormat;
exports.makeParseableTextFormat = makeParseableTextFormat;
exports.isAutoParsableResponseFormat = isAutoParsableResponseFormat;
exports.makeParseableTool = makeParseableTool;
exports.isAutoParsableTool = isAutoParsableTool;
exports.maybeParseChatCompletion = maybeParseChatCompletion;
exports.parseChatCompletion = parseChatCompletion;
exports.shouldParseToolCall = shouldParseToolCall;
exports.hasAutoParseableInput = hasAutoParseableInput;
exports.validateInputTools = validateInputTools;
const error_1 = require("../error.js");
function makeParseableResponseFormat(response_format, parser) {
    const obj = { ...response_format };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-response-format',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
    });
    return obj;
}
function makeParseableTextFormat(response_format, parser) {
    const obj = { ...response_format };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-response-format',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
    });
    return obj;
}
function isAutoParsableResponseFormat(response_format) {
    return response_format?.['$brand'] === 'auto-parseable-response-format';
}
function makeParseableTool(tool, { parser, callback, }) {
    const obj = { ...tool };
    Object.defineProperties(obj, {
        $brand: {
            value: 'auto-parseable-tool',
            enumerable: false,
        },
        $parseRaw: {
            value: parser,
            enumerable: false,
        },
        $callback: {
            value: callback,
            enumerable: false,
        },
    });
    return obj;
}
function isAutoParsableTool(tool) {
    return tool?.['$brand'] === 'auto-parseable-tool';
}
function maybeParseChatCompletion(completion, params) {
    if (!params || !hasAutoParseableInput(params)) {
        return {
            ...completion,
            choices: completion.choices.map((choice) => ({
                ...choice,
                message: {
                    ...choice.message,
                    parsed: null,
                    ...(choice.message.tool_calls ?
                        {
                            tool_calls: choice.message.tool_calls,
                        }
                        : undefined),
                },
            })),
        };
    }
    return parseChatCompletion(completion, params);
}
function parseChatCompletion(completion, params) {
    const choices = completion.choices.map((choice) => {
        if (choice.finish_reason === 'length') {
            throw new error_1.LengthFinishReasonError();
        }
        if (choice.finish_reason === 'content_filter') {
            throw new error_1.ContentFilterFinishReasonError();
        }
        return {
            ...choice,
            message: {
                ...choice.message,
                ...(choice.message.tool_calls ?
                    {
                        tool_calls: choice.message.tool_calls?.map((toolCall) => parseToolCall(params, toolCall)) ?? undefined,
                    }
                    : undefined),
                parsed: choice.message.content && !choice.message.refusal ?
                    parseResponseFormat(params, choice.message.content)
                    : null,
            },
        };
    });
    return { ...completion, choices };
}
function parseResponseFormat(params, content) {
    if (params.response_format?.type !== 'json_schema') {
        return null;
    }
    if (params.response_format?.type === 'json_schema') {
        if ('$parseRaw' in params.response_format) {
            const response_format = params.response_format;
            return response_format.$parseRaw(content);
        }
        return JSON.parse(content);
    }
    return null;
}
function parseToolCall(params, toolCall) {
    const inputTool = params.tools?.find((inputTool) => inputTool.function?.name === toolCall.function.name);
    return {
        ...toolCall,
        function: {
            ...toolCall.function,
            parsed_arguments: isAutoParsableTool(inputTool) ? inputTool.$parseRaw(toolCall.function.arguments)
                : inputTool?.function.strict ? JSON.parse(toolCall.function.arguments)
                    : null,
        },
    };
}
function shouldParseToolCall(params, toolCall) {
    if (!params) {
        return false;
    }
    const inputTool = params.tools?.find((inputTool) => inputTool.function?.name === toolCall.function.name);
    return isAutoParsableTool(inputTool) || inputTool?.function.strict || false;
}
function hasAutoParseableInput(params) {
    if (isAutoParsableResponseFormat(params.response_format)) {
        return true;
    }
    return (params.tools?.some((t) => isAutoParsableTool(t) || (t.type === 'function' && t.function.strict === true)) ?? false);
}
function validateInputTools(tools) {
    for (const tool of tools ?? []) {
        if (tool.type !== 'function') {
            throw new error_1.OpenAIError(`Currently only \`function\` tool types support auto-parsing; Received \`${tool.type}\``);
        }
        if (tool.function.strict !== true) {
            throw new error_1.OpenAIError(`The \`${tool.function.name}\` tool is not marked with \`strict: true\`. Only strict function tools can be auto-parsed`);
        }
    }
}

},{"../error.js":13}],49:[function(require,module,exports){
"use strict";
var _ResponseStream_instances, _ResponseStream_params, _ResponseStream_currentResponseSnapshot, _ResponseStream_finalResponse, _ResponseStream_beginRequest, _ResponseStream_addEvent, _ResponseStream_endRequest, _ResponseStream_accumulateResponse;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseStream = void 0;
const tslib_1 = require("../../internal/tslib.js");
const error_1 = require("../../error.js");
const EventStream_1 = require("../EventStream.js");
const ResponsesParser_1 = require("../ResponsesParser.js");
class ResponseStream extends EventStream_1.EventStream {
    constructor(params) {
        super();
        _ResponseStream_instances.add(this);
        _ResponseStream_params.set(this, void 0);
        _ResponseStream_currentResponseSnapshot.set(this, void 0);
        _ResponseStream_finalResponse.set(this, void 0);
        tslib_1.__classPrivateFieldSet(this, _ResponseStream_params, params, "f");
    }
    static createResponse(client, params, options) {
        const runner = new ResponseStream(params);
        runner._run(() => runner._createOrRetrieveResponse(client, params, {
            ...options,
            headers: { ...options?.headers, 'X-Stainless-Helper-Method': 'stream' },
        }));
        return runner;
    }
    async _createOrRetrieveResponse(client, params, options) {
        const signal = options?.signal;
        if (signal) {
            if (signal.aborted)
                this.controller.abort();
            signal.addEventListener('abort', () => this.controller.abort());
        }
        tslib_1.__classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_beginRequest).call(this);
        let stream;
        let starting_after = null;
        if ('response_id' in params) {
            stream = await client.responses.retrieve(params.response_id, { stream: true }, { ...options, signal: this.controller.signal, stream: true });
            starting_after = params.starting_after ?? null;
        }
        else {
            stream = await client.responses.create({ ...params, stream: true }, { ...options, signal: this.controller.signal });
        }
        this._connected();
        for await (const event of stream) {
            tslib_1.__classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_addEvent).call(this, event, starting_after);
        }
        if (stream.controller.signal?.aborted) {
            throw new error_1.APIUserAbortError();
        }
        return tslib_1.__classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_endRequest).call(this);
    }
    [(_ResponseStream_params = new WeakMap(), _ResponseStream_currentResponseSnapshot = new WeakMap(), _ResponseStream_finalResponse = new WeakMap(), _ResponseStream_instances = new WeakSet(), _ResponseStream_beginRequest = function _ResponseStream_beginRequest() {
        if (this.ended)
            return;
        tslib_1.__classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
    }, _ResponseStream_addEvent = function _ResponseStream_addEvent(event, starting_after) {
        if (this.ended)
            return;
        const maybeEmit = (name, event) => {
            if (starting_after == null || event.sequence_number > starting_after) {
                this._emit(name, event);
            }
        };
        const response = tslib_1.__classPrivateFieldGet(this, _ResponseStream_instances, "m", _ResponseStream_accumulateResponse).call(this, event);
        maybeEmit('event', event);
        switch (event.type) {
            case 'response.output_text.delta': {
                const output = response.output[event.output_index];
                if (!output) {
                    throw new error_1.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    const content = output.content[event.content_index];
                    if (!content) {
                        throw new error_1.OpenAIError(`missing content at index ${event.content_index}`);
                    }
                    if (content.type !== 'output_text') {
                        throw new error_1.OpenAIError(`expected content to be 'output_text', got ${content.type}`);
                    }
                    maybeEmit('response.output_text.delta', {
                        ...event,
                        snapshot: content.text,
                    });
                }
                break;
            }
            case 'response.function_call_arguments.delta': {
                const output = response.output[event.output_index];
                if (!output) {
                    throw new error_1.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'function_call') {
                    maybeEmit('response.function_call_arguments.delta', {
                        ...event,
                        snapshot: output.arguments,
                    });
                }
                break;
            }
            default:
                maybeEmit(event.type, event);
                break;
        }
    }, _ResponseStream_endRequest = function _ResponseStream_endRequest() {
        if (this.ended) {
            throw new error_1.OpenAIError(`stream has ended, this shouldn't happen`);
        }
        const snapshot = tslib_1.__classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
        if (!snapshot) {
            throw new error_1.OpenAIError(`request ended without sending any events`);
        }
        tslib_1.__classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, undefined, "f");
        const parsedResponse = finalizeResponse(snapshot, tslib_1.__classPrivateFieldGet(this, _ResponseStream_params, "f"));
        tslib_1.__classPrivateFieldSet(this, _ResponseStream_finalResponse, parsedResponse, "f");
        return parsedResponse;
    }, _ResponseStream_accumulateResponse = function _ResponseStream_accumulateResponse(event) {
        let snapshot = tslib_1.__classPrivateFieldGet(this, _ResponseStream_currentResponseSnapshot, "f");
        if (!snapshot) {
            if (event.type !== 'response.created') {
                throw new error_1.OpenAIError(`When snapshot hasn't been set yet, expected 'response.created' event, got ${event.type}`);
            }
            snapshot = tslib_1.__classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
            return snapshot;
        }
        switch (event.type) {
            case 'response.output_item.added': {
                snapshot.output.push(event.item);
                break;
            }
            case 'response.content_part.added': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new error_1.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    output.content.push(event.part);
                }
                break;
            }
            case 'response.output_text.delta': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new error_1.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'message') {
                    const content = output.content[event.content_index];
                    if (!content) {
                        throw new error_1.OpenAIError(`missing content at index ${event.content_index}`);
                    }
                    if (content.type !== 'output_text') {
                        throw new error_1.OpenAIError(`expected content to be 'output_text', got ${content.type}`);
                    }
                    content.text += event.delta;
                }
                break;
            }
            case 'response.function_call_arguments.delta': {
                const output = snapshot.output[event.output_index];
                if (!output) {
                    throw new error_1.OpenAIError(`missing output at index ${event.output_index}`);
                }
                if (output.type === 'function_call') {
                    output.arguments += event.delta;
                }
                break;
            }
            case 'response.completed': {
                tslib_1.__classPrivateFieldSet(this, _ResponseStream_currentResponseSnapshot, event.response, "f");
                break;
            }
        }
        return snapshot;
    }, Symbol.asyncIterator)]() {
        const pushQueue = [];
        const readQueue = [];
        let done = false;
        this.on('event', (event) => {
            const reader = readQueue.shift();
            if (reader) {
                reader.resolve(event);
            }
            else {
                pushQueue.push(event);
            }
        });
        this.on('end', () => {
            done = true;
            for (const reader of readQueue) {
                reader.resolve(undefined);
            }
            readQueue.length = 0;
        });
        this.on('abort', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        this.on('error', (err) => {
            done = true;
            for (const reader of readQueue) {
                reader.reject(err);
            }
            readQueue.length = 0;
        });
        return {
            next: async () => {
                if (!pushQueue.length) {
                    if (done) {
                        return { value: undefined, done: true };
                    }
                    return new Promise((resolve, reject) => readQueue.push({ resolve, reject })).then((event) => (event ? { value: event, done: false } : { value: undefined, done: true }));
                }
                const event = pushQueue.shift();
                return { value: event, done: false };
            },
            return: async () => {
                this.abort();
                return { value: undefined, done: true };
            },
        };
    }
    /**
     * @returns a promise that resolves with the final Response, or rejects
     * if an error occurred or the stream ended prematurely without producing a REsponse.
     */
    async finalResponse() {
        await this.done();
        const response = tslib_1.__classPrivateFieldGet(this, _ResponseStream_finalResponse, "f");
        if (!response)
            throw new error_1.OpenAIError('stream ended without producing a ChatCompletion');
        return response;
    }
}
exports.ResponseStream = ResponseStream;
function finalizeResponse(snapshot, params) {
    return (0, ResponsesParser_1.maybeParseResponse)(snapshot, params);
}

},{"../../error.js":13,"../../internal/tslib.js":27,"../EventStream.js":43,"../ResponsesParser.js":44}],50:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Audio = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const SpeechAPI = tslib_1.__importStar(require("./speech.js"));
const speech_1 = require("./speech.js");
const TranscriptionsAPI = tslib_1.__importStar(require("./transcriptions.js"));
const transcriptions_1 = require("./transcriptions.js");
const TranslationsAPI = tslib_1.__importStar(require("./translations.js"));
const translations_1 = require("./translations.js");
class Audio extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.transcriptions = new TranscriptionsAPI.Transcriptions(this._client);
        this.translations = new TranslationsAPI.Translations(this._client);
        this.speech = new SpeechAPI.Speech(this._client);
    }
}
exports.Audio = Audio;
Audio.Transcriptions = transcriptions_1.Transcriptions;
Audio.Translations = translations_1.Translations;
Audio.Speech = speech_1.Speech;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"./speech.js":51,"./transcriptions.js":52,"./translations.js":53}],51:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Speech = void 0;
const resource_1 = require("../../core/resource.js");
const headers_1 = require("../../internal/headers.js");
class Speech extends resource_1.APIResource {
    /**
     * Generates audio from the input text.
     *
     * @example
     * ```ts
     * const speech = await client.audio.speech.create({
     *   input: 'input',
     *   model: 'string',
     *   voice: 'ash',
     * });
     *
     * const content = await speech.blob();
     * console.log(content);
     * ```
     */
    create(body, options) {
        return this._client.post('/audio/speech', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: 'application/octet-stream' }, options?.headers]),
            __binaryResponse: true,
        });
    }
}
exports.Speech = Speech;

},{"../../core/resource.js":10,"../../internal/headers.js":18}],52:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transcriptions = void 0;
const resource_1 = require("../../core/resource.js");
const uploads_1 = require("../../internal/uploads.js");
class Transcriptions extends resource_1.APIResource {
    create(body, options) {
        return this._client.post('/audio/transcriptions', (0, uploads_1.multipartFormRequestOptions)({
            body,
            ...options,
            stream: body.stream ?? false,
            __metadata: { model: body.model },
        }, this._client));
    }
}
exports.Transcriptions = Transcriptions;

},{"../../core/resource.js":10,"../../internal/uploads.js":28}],53:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Translations = void 0;
const resource_1 = require("../../core/resource.js");
const uploads_1 = require("../../internal/uploads.js");
class Translations extends resource_1.APIResource {
    create(body, options) {
        return this._client.post('/audio/translations', (0, uploads_1.multipartFormRequestOptions)({ body, ...options, __metadata: { model: body.model } }, this._client));
    }
}
exports.Translations = Translations;

},{"../../core/resource.js":10,"../../internal/uploads.js":28}],54:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Batches = void 0;
const resource_1 = require("../core/resource.js");
const pagination_1 = require("../core/pagination.js");
const path_1 = require("../internal/utils/path.js");
class Batches extends resource_1.APIResource {
    /**
     * Creates and executes a batch from an uploaded file of requests
     */
    create(body, options) {
        return this._client.post('/batches', { body, ...options });
    }
    /**
     * Retrieves a batch.
     */
    retrieve(batchID, options) {
        return this._client.get((0, path_1.path) `/batches/${batchID}`, options);
    }
    /**
     * List your organization's batches.
     */
    list(query = {}, options) {
        return this._client.getAPIList('/batches', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Cancels an in-progress batch. The batch will be in status `cancelling` for up to
     * 10 minutes, before changing to `cancelled`, where it will have partial results
     * (if any) available in the output file.
     */
    cancel(batchID, options) {
        return this._client.post((0, path_1.path) `/batches/${batchID}/cancel`, options);
    }
}
exports.Batches = Batches;

},{"../core/pagination.js":9,"../core/resource.js":10,"../internal/utils/path.js":34}],55:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Assistants = void 0;
const resource_1 = require("../../core/resource.js");
const pagination_1 = require("../../core/pagination.js");
const headers_1 = require("../../internal/headers.js");
const path_1 = require("../../internal/utils/path.js");
class Assistants extends resource_1.APIResource {
    /**
     * Create an assistant with a model and instructions.
     *
     * @example
     * ```ts
     * const assistant = await client.beta.assistants.create({
     *   model: 'gpt-4o',
     * });
     * ```
     */
    create(body, options) {
        return this._client.post('/assistants', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieves an assistant.
     *
     * @example
     * ```ts
     * const assistant = await client.beta.assistants.retrieve(
     *   'assistant_id',
     * );
     * ```
     */
    retrieve(assistantID, options) {
        return this._client.get((0, path_1.path) `/assistants/${assistantID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Modifies an assistant.
     *
     * @example
     * ```ts
     * const assistant = await client.beta.assistants.update(
     *   'assistant_id',
     * );
     * ```
     */
    update(assistantID, body, options) {
        return this._client.post((0, path_1.path) `/assistants/${assistantID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of assistants.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const assistant of client.beta.assistants.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/assistants', (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Delete an assistant.
     *
     * @example
     * ```ts
     * const assistantDeleted =
     *   await client.beta.assistants.delete('assistant_id');
     * ```
     */
    delete(assistantID, options) {
        return this._client.delete((0, path_1.path) `/assistants/${assistantID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.Assistants = Assistants;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/utils/path.js":34}],56:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Beta = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const AssistantsAPI = tslib_1.__importStar(require("./assistants.js"));
const assistants_1 = require("./assistants.js");
const RealtimeAPI = tslib_1.__importStar(require("./realtime/realtime.js"));
const realtime_1 = require("./realtime/realtime.js");
const ThreadsAPI = tslib_1.__importStar(require("./threads/threads.js"));
const threads_1 = require("./threads/threads.js");
class Beta extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.realtime = new RealtimeAPI.Realtime(this._client);
        this.assistants = new AssistantsAPI.Assistants(this._client);
        this.threads = new ThreadsAPI.Threads(this._client);
    }
}
exports.Beta = Beta;
Beta.Realtime = realtime_1.Realtime;
Beta.Assistants = assistants_1.Assistants;
Beta.Threads = threads_1.Threads;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"./assistants.js":55,"./realtime/realtime.js":57,"./threads/threads.js":63}],57:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Realtime = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const SessionsAPI = tslib_1.__importStar(require("./sessions.js"));
const sessions_1 = require("./sessions.js");
const TranscriptionSessionsAPI = tslib_1.__importStar(require("./transcription-sessions.js"));
const transcription_sessions_1 = require("./transcription-sessions.js");
class Realtime extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.sessions = new SessionsAPI.Sessions(this._client);
        this.transcriptionSessions = new TranscriptionSessionsAPI.TranscriptionSessions(this._client);
    }
}
exports.Realtime = Realtime;
Realtime.Sessions = sessions_1.Sessions;
Realtime.TranscriptionSessions = transcription_sessions_1.TranscriptionSessions;

},{"../../../core/resource.js":10,"../../../internal/tslib.js":27,"./sessions.js":58,"./transcription-sessions.js":59}],58:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sessions = void 0;
const resource_1 = require("../../../core/resource.js");
const headers_1 = require("../../../internal/headers.js");
class Sessions extends resource_1.APIResource {
    /**
     * Create an ephemeral API token for use in client-side applications with the
     * Realtime API. Can be configured with the same session parameters as the
     * `session.update` client event.
     *
     * It responds with a session object, plus a `client_secret` key which contains a
     * usable ephemeral API token that can be used to authenticate browser clients for
     * the Realtime API.
     *
     * @example
     * ```ts
     * const session =
     *   await client.beta.realtime.sessions.create();
     * ```
     */
    create(body, options) {
        return this._client.post('/realtime/sessions', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.Sessions = Sessions;

},{"../../../core/resource.js":10,"../../../internal/headers.js":18}],59:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionSessions = void 0;
const resource_1 = require("../../../core/resource.js");
const headers_1 = require("../../../internal/headers.js");
class TranscriptionSessions extends resource_1.APIResource {
    /**
     * Create an ephemeral API token for use in client-side applications with the
     * Realtime API specifically for realtime transcriptions. Can be configured with
     * the same session parameters as the `transcription_session.update` client event.
     *
     * It responds with a session object, plus a `client_secret` key which contains a
     * usable ephemeral API token that can be used to authenticate browser clients for
     * the Realtime API.
     *
     * @example
     * ```ts
     * const transcriptionSession =
     *   await client.beta.realtime.transcriptionSessions.create();
     * ```
     */
    create(body, options) {
        return this._client.post('/realtime/transcription_sessions', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.TranscriptionSessions = TranscriptionSessions;

},{"../../../core/resource.js":10,"../../../internal/headers.js":18}],60:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messages = void 0;
const resource_1 = require("../../../core/resource.js");
const pagination_1 = require("../../../core/pagination.js");
const headers_1 = require("../../../internal/headers.js");
const path_1 = require("../../../internal/utils/path.js");
/**
 * @deprecated The Assistants API is deprecated in favor of the Responses API
 */
class Messages extends resource_1.APIResource {
    /**
     * Create a message.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    create(threadID, body, options) {
        return this._client.post((0, path_1.path) `/threads/${threadID}/messages`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieve a message.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    retrieve(messageID, params, options) {
        const { thread_id } = params;
        return this._client.get((0, path_1.path) `/threads/${thread_id}/messages/${messageID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Modifies a message.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    update(messageID, params, options) {
        const { thread_id, ...body } = params;
        return this._client.post((0, path_1.path) `/threads/${thread_id}/messages/${messageID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of messages for a given thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    list(threadID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/threads/${threadID}/messages`, (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Deletes a message.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    delete(messageID, params, options) {
        const { thread_id } = params;
        return this._client.delete((0, path_1.path) `/threads/${thread_id}/messages/${messageID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.Messages = Messages;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/headers.js":18,"../../../internal/utils/path.js":34}],61:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runs = void 0;
const tslib_1 = require("../../../../internal/tslib.js");
const resource_1 = require("../../../../core/resource.js");
const StepsAPI = tslib_1.__importStar(require("./steps.js"));
const steps_1 = require("./steps.js");
const pagination_1 = require("../../../../core/pagination.js");
const headers_1 = require("../../../../internal/headers.js");
const AssistantStream_1 = require("../../../../lib/AssistantStream.js");
const sleep_1 = require("../../../../internal/utils/sleep.js");
const path_1 = require("../../../../internal/utils/path.js");
/**
 * @deprecated The Assistants API is deprecated in favor of the Responses API
 */
class Runs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.steps = new StepsAPI.Steps(this._client);
    }
    create(threadID, params, options) {
        const { include, ...body } = params;
        return this._client.post((0, path_1.path) `/threads/${threadID}/runs`, {
            query: { include },
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
            stream: params.stream ?? false,
        });
    }
    /**
     * Retrieves a run.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    retrieve(runID, params, options) {
        const { thread_id } = params;
        return this._client.get((0, path_1.path) `/threads/${thread_id}/runs/${runID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Modifies a run.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    update(runID, params, options) {
        const { thread_id, ...body } = params;
        return this._client.post((0, path_1.path) `/threads/${thread_id}/runs/${runID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of runs belonging to a thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    list(threadID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/threads/${threadID}/runs`, (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Cancels a run that is `in_progress`.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    cancel(runID, params, options) {
        const { thread_id } = params;
        return this._client.post((0, path_1.path) `/threads/${thread_id}/runs/${runID}/cancel`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * A helper to create a run an poll for a terminal state. More information on Run
     * lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async createAndPoll(threadId, body, options) {
        const run = await this.create(threadId, body, options);
        return await this.poll(run.id, { thread_id: threadId }, options);
    }
    /**
     * Create a Run stream
     *
     * @deprecated use `stream` instead
     */
    createAndStream(threadId, body, options) {
        return AssistantStream_1.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    /**
     * A helper to poll a run status until it reaches a terminal state. More
     * information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async poll(runId, params, options) {
        const headers = (0, headers_1.buildHeaders)([
            options?.headers,
            {
                'X-Stainless-Poll-Helper': 'true',
                'X-Stainless-Custom-Poll-Interval': options?.pollIntervalMs?.toString() ?? undefined,
            },
        ]);
        while (true) {
            const { data: run, response } = await this.retrieve(runId, params, {
                ...options,
                headers: { ...options?.headers, ...headers },
            }).withResponse();
            switch (run.status) {
                //If we are in any sort of intermediate state we poll
                case 'queued':
                case 'in_progress':
                case 'cancelling':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0, sleep_1.sleep)(sleepInterval);
                    break;
                //We return the run in any terminal state.
                case 'requires_action':
                case 'incomplete':
                case 'cancelled':
                case 'completed':
                case 'failed':
                case 'expired':
                    return run;
            }
        }
    }
    /**
     * Create a Run stream
     */
    stream(threadId, body, options) {
        return AssistantStream_1.AssistantStream.createAssistantStream(threadId, this._client.beta.threads.runs, body, options);
    }
    submitToolOutputs(runID, params, options) {
        const { thread_id, ...body } = params;
        return this._client.post((0, path_1.path) `/threads/${thread_id}/runs/${runID}/submit_tool_outputs`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
            stream: params.stream ?? false,
        });
    }
    /**
     * A helper to submit a tool output to a run and poll for a terminal run state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async submitToolOutputsAndPoll(runId, params, options) {
        const run = await this.submitToolOutputs(runId, params, options);
        return await this.poll(run.id, params, options);
    }
    /**
     * Submit the tool outputs from a previous run and stream the run to a terminal
     * state. More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    submitToolOutputsStream(runId, params, options) {
        return AssistantStream_1.AssistantStream.createToolAssistantStream(runId, this._client.beta.threads.runs, params, options);
    }
}
exports.Runs = Runs;
Runs.Steps = steps_1.Steps;

},{"../../../../core/pagination.js":9,"../../../../core/resource.js":10,"../../../../internal/headers.js":18,"../../../../internal/tslib.js":27,"../../../../internal/utils/path.js":34,"../../../../internal/utils/sleep.js":35,"../../../../lib/AssistantStream.js":39,"./steps.js":62}],62:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Steps = void 0;
const resource_1 = require("../../../../core/resource.js");
const pagination_1 = require("../../../../core/pagination.js");
const headers_1 = require("../../../../internal/headers.js");
const path_1 = require("../../../../internal/utils/path.js");
/**
 * @deprecated The Assistants API is deprecated in favor of the Responses API
 */
class Steps extends resource_1.APIResource {
    /**
     * Retrieves a run step.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    retrieve(stepID, params, options) {
        const { thread_id, run_id, ...query } = params;
        return this._client.get((0, path_1.path) `/threads/${thread_id}/runs/${run_id}/steps/${stepID}`, {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of run steps belonging to a run.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    list(runID, params, options) {
        const { thread_id, ...query } = params;
        return this._client.getAPIList((0, path_1.path) `/threads/${thread_id}/runs/${runID}/steps`, (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.Steps = Steps;

},{"../../../../core/pagination.js":9,"../../../../core/resource.js":10,"../../../../internal/headers.js":18,"../../../../internal/utils/path.js":34}],63:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Threads = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const MessagesAPI = tslib_1.__importStar(require("./messages.js"));
const messages_1 = require("./messages.js");
const RunsAPI = tslib_1.__importStar(require("./runs/runs.js"));
const runs_1 = require("./runs/runs.js");
const headers_1 = require("../../../internal/headers.js");
const AssistantStream_1 = require("../../../lib/AssistantStream.js");
const path_1 = require("../../../internal/utils/path.js");
/**
 * @deprecated The Assistants API is deprecated in favor of the Responses API
 */
class Threads extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.runs = new RunsAPI.Runs(this._client);
        this.messages = new MessagesAPI.Messages(this._client);
    }
    /**
     * Create a thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    create(body = {}, options) {
        return this._client.post('/threads', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieves a thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    retrieve(threadID, options) {
        return this._client.get((0, path_1.path) `/threads/${threadID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Modifies a thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    update(threadID, body, options) {
        return this._client.post((0, path_1.path) `/threads/${threadID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Delete a thread.
     *
     * @deprecated The Assistants API is deprecated in favor of the Responses API
     */
    delete(threadID, options) {
        return this._client.delete((0, path_1.path) `/threads/${threadID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    createAndRun(body, options) {
        return this._client.post('/threads/runs', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
            stream: body.stream ?? false,
        });
    }
    /**
     * A helper to create a thread, start a run and then poll for a terminal state.
     * More information on Run lifecycles can be found here:
     * https://platform.openai.com/docs/assistants/how-it-works/runs-and-run-steps
     */
    async createAndRunPoll(body, options) {
        const run = await this.createAndRun(body, options);
        return await this.runs.poll(run.id, { thread_id: run.thread_id }, options);
    }
    /**
     * Create a thread and stream the run back
     */
    createAndRunStream(body, options) {
        return AssistantStream_1.AssistantStream.createThreadAssistantStream(body, this._client.beta.threads, options);
    }
}
exports.Threads = Threads;
Threads.Runs = runs_1.Runs;
Threads.Messages = messages_1.Messages;

},{"../../../core/resource.js":10,"../../../internal/headers.js":18,"../../../internal/tslib.js":27,"../../../internal/utils/path.js":34,"../../../lib/AssistantStream.js":39,"./messages.js":60,"./runs/runs.js":61}],64:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const CompletionsAPI = tslib_1.__importStar(require("./completions/completions.js"));
const completions_1 = require("./completions/completions.js");
class Chat extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.completions = new CompletionsAPI.Completions(this._client);
    }
}
exports.Chat = Chat;
Chat.Completions = completions_1.Completions;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"./completions/completions.js":65}],65:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatCompletionRunner = exports.ChatCompletionStream = exports.ParsingToolFunction = exports.ChatCompletionStreamingRunner = exports.Completions = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const MessagesAPI = tslib_1.__importStar(require("./messages.js"));
const messages_1 = require("./messages.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
const ChatCompletionRunner_1 = require("../../../lib/ChatCompletionRunner.js");
const ChatCompletionStreamingRunner_1 = require("../../../lib/ChatCompletionStreamingRunner.js");
const ChatCompletionStream_1 = require("../../../lib/ChatCompletionStream.js");
const parser_1 = require("../../../lib/parser.js");
class Completions extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.messages = new MessagesAPI.Messages(this._client);
    }
    create(body, options) {
        return this._client.post('/chat/completions', { body, ...options, stream: body.stream ?? false });
    }
    /**
     * Get a stored chat completion. Only Chat Completions that have been created with
     * the `store` parameter set to `true` will be returned.
     *
     * @example
     * ```ts
     * const chatCompletion =
     *   await client.chat.completions.retrieve('completion_id');
     * ```
     */
    retrieve(completionID, options) {
        return this._client.get((0, path_1.path) `/chat/completions/${completionID}`, options);
    }
    /**
     * Modify a stored chat completion. Only Chat Completions that have been created
     * with the `store` parameter set to `true` can be modified. Currently, the only
     * supported modification is to update the `metadata` field.
     *
     * @example
     * ```ts
     * const chatCompletion = await client.chat.completions.update(
     *   'completion_id',
     *   { metadata: { foo: 'string' } },
     * );
     * ```
     */
    update(completionID, body, options) {
        return this._client.post((0, path_1.path) `/chat/completions/${completionID}`, { body, ...options });
    }
    /**
     * List stored Chat Completions. Only Chat Completions that have been stored with
     * the `store` parameter set to `true` will be returned.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const chatCompletion of client.chat.completions.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/chat/completions', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Delete a stored chat completion. Only Chat Completions that have been created
     * with the `store` parameter set to `true` can be deleted.
     *
     * @example
     * ```ts
     * const chatCompletionDeleted =
     *   await client.chat.completions.delete('completion_id');
     * ```
     */
    delete(completionID, options) {
        return this._client.delete((0, path_1.path) `/chat/completions/${completionID}`, options);
    }
    parse(body, options) {
        (0, parser_1.validateInputTools)(body.tools);
        return this._client.chat.completions
            .create(body, {
            ...options,
            headers: {
                ...options?.headers,
                'X-Stainless-Helper-Method': 'chat.completions.parse',
            },
        })
            ._thenUnwrap((completion) => (0, parser_1.parseChatCompletion)(completion, body));
    }
    runTools(body, options) {
        if (body.stream) {
            return ChatCompletionStreamingRunner_1.ChatCompletionStreamingRunner.runTools(this._client, body, options);
        }
        return ChatCompletionRunner_1.ChatCompletionRunner.runTools(this._client, body, options);
    }
    /**
     * Creates a chat completion stream
     */
    stream(body, options) {
        return ChatCompletionStream_1.ChatCompletionStream.createChatCompletion(this._client, body, options);
    }
}
exports.Completions = Completions;
var ChatCompletionStreamingRunner_2 = require("../../../lib/ChatCompletionStreamingRunner.js");
Object.defineProperty(exports, "ChatCompletionStreamingRunner", { enumerable: true, get: function () { return ChatCompletionStreamingRunner_2.ChatCompletionStreamingRunner; } });
var RunnableFunction_1 = require("../../../lib/RunnableFunction.js");
Object.defineProperty(exports, "ParsingToolFunction", { enumerable: true, get: function () { return RunnableFunction_1.ParsingToolFunction; } });
var ChatCompletionStream_2 = require("../../../lib/ChatCompletionStream.js");
Object.defineProperty(exports, "ChatCompletionStream", { enumerable: true, get: function () { return ChatCompletionStream_2.ChatCompletionStream; } });
var ChatCompletionRunner_2 = require("../../../lib/ChatCompletionRunner.js");
Object.defineProperty(exports, "ChatCompletionRunner", { enumerable: true, get: function () { return ChatCompletionRunner_2.ChatCompletionRunner; } });
Completions.Messages = messages_1.Messages;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/tslib.js":27,"../../../internal/utils/path.js":34,"../../../lib/ChatCompletionRunner.js":40,"../../../lib/ChatCompletionStream.js":41,"../../../lib/ChatCompletionStreamingRunner.js":42,"../../../lib/RunnableFunction.js":45,"../../../lib/parser.js":48,"./messages.js":67}],66:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messages = exports.Completions = void 0;
const tslib_1 = require("../../../internal/tslib.js");
var completions_1 = require("./completions.js");
Object.defineProperty(exports, "Completions", { enumerable: true, get: function () { return completions_1.Completions; } });
tslib_1.__exportStar(require("./completions.js"), exports);
var messages_1 = require("./messages.js");
Object.defineProperty(exports, "Messages", { enumerable: true, get: function () { return messages_1.Messages; } });

},{"../../../internal/tslib.js":27,"./completions.js":65,"./messages.js":67}],67:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Messages = void 0;
const resource_1 = require("../../../core/resource.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class Messages extends resource_1.APIResource {
    /**
     * Get the messages in a stored chat completion. Only Chat Completions that have
     * been created with the `store` parameter set to `true` will be returned.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const chatCompletionStoreMessage of client.chat.completions.messages.list(
     *   'completion_id',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(completionID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/chat/completions/${completionID}/messages`, (pagination_1.CursorPage), { query, ...options });
    }
}
exports.Messages = Messages;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/utils/path.js":34}],68:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Completions = exports.Chat = void 0;
var chat_1 = require("./chat.js");
Object.defineProperty(exports, "Chat", { enumerable: true, get: function () { return chat_1.Chat; } });
var index_1 = require("./completions/index.js");
Object.defineProperty(exports, "Completions", { enumerable: true, get: function () { return index_1.Completions; } });

},{"./chat.js":64,"./completions/index.js":66}],69:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Completions = void 0;
const resource_1 = require("../core/resource.js");
class Completions extends resource_1.APIResource {
    create(body, options) {
        return this._client.post('/completions', { body, ...options, stream: body.stream ?? false });
    }
}
exports.Completions = Completions;

},{"../core/resource.js":10}],70:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Containers = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const FilesAPI = tslib_1.__importStar(require("./files/files.js"));
const files_1 = require("./files/files.js");
const pagination_1 = require("../../core/pagination.js");
const headers_1 = require("../../internal/headers.js");
const path_1 = require("../../internal/utils/path.js");
class Containers extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.files = new FilesAPI.Files(this._client);
    }
    /**
     * Create Container
     */
    create(body, options) {
        return this._client.post('/containers', { body, ...options });
    }
    /**
     * Retrieve Container
     */
    retrieve(containerID, options) {
        return this._client.get((0, path_1.path) `/containers/${containerID}`, options);
    }
    /**
     * List Containers
     */
    list(query = {}, options) {
        return this._client.getAPIList('/containers', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Delete Container
     */
    delete(containerID, options) {
        return this._client.delete((0, path_1.path) `/containers/${containerID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: '*/*' }, options?.headers]),
        });
    }
}
exports.Containers = Containers;
Containers.Files = files_1.Files;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/tslib.js":27,"../../internal/utils/path.js":34,"./files/files.js":72}],71:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Content = void 0;
const resource_1 = require("../../../core/resource.js");
const headers_1 = require("../../../internal/headers.js");
const path_1 = require("../../../internal/utils/path.js");
class Content extends resource_1.APIResource {
    /**
     * Retrieve Container File Content
     */
    retrieve(fileID, params, options) {
        const { container_id } = params;
        return this._client.get((0, path_1.path) `/containers/${container_id}/files/${fileID}/content`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: 'application/binary' }, options?.headers]),
            __binaryResponse: true,
        });
    }
}
exports.Content = Content;

},{"../../../core/resource.js":10,"../../../internal/headers.js":18,"../../../internal/utils/path.js":34}],72:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Files = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const ContentAPI = tslib_1.__importStar(require("./content.js"));
const content_1 = require("./content.js");
const pagination_1 = require("../../../core/pagination.js");
const headers_1 = require("../../../internal/headers.js");
const uploads_1 = require("../../../internal/uploads.js");
const path_1 = require("../../../internal/utils/path.js");
class Files extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.content = new ContentAPI.Content(this._client);
    }
    /**
     * Create a Container File
     *
     * You can send either a multipart/form-data request with the raw file content, or
     * a JSON request with a file ID.
     */
    create(containerID, body, options) {
        return this._client.post((0, path_1.path) `/containers/${containerID}/files`, (0, uploads_1.multipartFormRequestOptions)({ body, ...options }, this._client));
    }
    /**
     * Retrieve Container File
     */
    retrieve(fileID, params, options) {
        const { container_id } = params;
        return this._client.get((0, path_1.path) `/containers/${container_id}/files/${fileID}`, options);
    }
    /**
     * List Container files
     */
    list(containerID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/containers/${containerID}/files`, (pagination_1.CursorPage), {
            query,
            ...options,
        });
    }
    /**
     * Delete Container File
     */
    delete(fileID, params, options) {
        const { container_id } = params;
        return this._client.delete((0, path_1.path) `/containers/${container_id}/files/${fileID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: '*/*' }, options?.headers]),
        });
    }
}
exports.Files = Files;
Files.Content = content_1.Content;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/headers.js":18,"../../../internal/tslib.js":27,"../../../internal/uploads.js":28,"../../../internal/utils/path.js":34,"./content.js":71}],73:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Embeddings = void 0;
const resource_1 = require("../core/resource.js");
const utils_1 = require("../internal/utils.js");
class Embeddings extends resource_1.APIResource {
    /**
     * Creates an embedding vector representing the input text.
     *
     * @example
     * ```ts
     * const createEmbeddingResponse =
     *   await client.embeddings.create({
     *     input: 'The quick brown fox jumped over the lazy dog',
     *     model: 'text-embedding-3-small',
     *   });
     * ```
     */
    create(body, options) {
        const hasUserProvidedEncodingFormat = !!body.encoding_format;
        // No encoding_format specified, defaulting to base64 for performance reasons
        // See https://github.com/openai/openai-node/pull/1312
        let encoding_format = hasUserProvidedEncodingFormat ? body.encoding_format : 'base64';
        if (hasUserProvidedEncodingFormat) {
            (0, utils_1.loggerFor)(this._client).debug('embeddings/user defined encoding_format:', body.encoding_format);
        }
        const response = this._client.post('/embeddings', {
            body: {
                ...body,
                encoding_format: encoding_format,
            },
            ...options,
        });
        // if the user specified an encoding_format, return the response as-is
        if (hasUserProvidedEncodingFormat) {
            return response;
        }
        // in this stage, we are sure the user did not specify an encoding_format
        // and we defaulted to base64 for performance reasons
        // we are sure then that the response is base64 encoded, let's decode it
        // the returned result will be a float32 array since this is OpenAI API's default encoding
        (0, utils_1.loggerFor)(this._client).debug('embeddings/decoding base64 embeddings from base64');
        return response._thenUnwrap((response) => {
            if (response && response.data) {
                response.data.forEach((embeddingBase64Obj) => {
                    const embeddingBase64Str = embeddingBase64Obj.embedding;
                    embeddingBase64Obj.embedding = (0, utils_1.toFloat32Array)(embeddingBase64Str);
                });
            }
            return response;
        });
    }
}
exports.Embeddings = Embeddings;

},{"../core/resource.js":10,"../internal/utils.js":29}],74:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Evals = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const RunsAPI = tslib_1.__importStar(require("./runs/runs.js"));
const runs_1 = require("./runs/runs.js");
const pagination_1 = require("../../core/pagination.js");
const path_1 = require("../../internal/utils/path.js");
class Evals extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.runs = new RunsAPI.Runs(this._client);
    }
    /**
     * Create the structure of an evaluation that can be used to test a model's
     * performance. An evaluation is a set of testing criteria and the config for a
     * data source, which dictates the schema of the data used in the evaluation. After
     * creating an evaluation, you can run it on different models and model parameters.
     * We support several types of graders and datasources. For more information, see
     * the [Evals guide](https://platform.openai.com/docs/guides/evals).
     */
    create(body, options) {
        return this._client.post('/evals', { body, ...options });
    }
    /**
     * Get an evaluation by ID.
     */
    retrieve(evalID, options) {
        return this._client.get((0, path_1.path) `/evals/${evalID}`, options);
    }
    /**
     * Update certain properties of an evaluation.
     */
    update(evalID, body, options) {
        return this._client.post((0, path_1.path) `/evals/${evalID}`, { body, ...options });
    }
    /**
     * List evaluations for a project.
     */
    list(query = {}, options) {
        return this._client.getAPIList('/evals', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Delete an evaluation.
     */
    delete(evalID, options) {
        return this._client.delete((0, path_1.path) `/evals/${evalID}`, options);
    }
}
exports.Evals = Evals;
Evals.Runs = runs_1.Runs;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/tslib.js":27,"../../internal/utils/path.js":34,"./runs/runs.js":76}],75:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputItems = void 0;
const resource_1 = require("../../../core/resource.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class OutputItems extends resource_1.APIResource {
    /**
     * Get an evaluation run output item by ID.
     */
    retrieve(outputItemID, params, options) {
        const { eval_id, run_id } = params;
        return this._client.get((0, path_1.path) `/evals/${eval_id}/runs/${run_id}/output_items/${outputItemID}`, options);
    }
    /**
     * Get a list of output items for an evaluation run.
     */
    list(runID, params, options) {
        const { eval_id, ...query } = params;
        return this._client.getAPIList((0, path_1.path) `/evals/${eval_id}/runs/${runID}/output_items`, (pagination_1.CursorPage), { query, ...options });
    }
}
exports.OutputItems = OutputItems;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/utils/path.js":34}],76:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Runs = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const OutputItemsAPI = tslib_1.__importStar(require("./output-items.js"));
const output_items_1 = require("./output-items.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class Runs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.outputItems = new OutputItemsAPI.OutputItems(this._client);
    }
    /**
     * Kicks off a new run for a given evaluation, specifying the data source, and what
     * model configuration to use to test. The datasource will be validated against the
     * schema specified in the config of the evaluation.
     */
    create(evalID, body, options) {
        return this._client.post((0, path_1.path) `/evals/${evalID}/runs`, { body, ...options });
    }
    /**
     * Get an evaluation run by ID.
     */
    retrieve(runID, params, options) {
        const { eval_id } = params;
        return this._client.get((0, path_1.path) `/evals/${eval_id}/runs/${runID}`, options);
    }
    /**
     * Get a list of runs for an evaluation.
     */
    list(evalID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/evals/${evalID}/runs`, (pagination_1.CursorPage), {
            query,
            ...options,
        });
    }
    /**
     * Delete an eval run.
     */
    delete(runID, params, options) {
        const { eval_id } = params;
        return this._client.delete((0, path_1.path) `/evals/${eval_id}/runs/${runID}`, options);
    }
    /**
     * Cancel an ongoing evaluation run.
     */
    cancel(runID, params, options) {
        const { eval_id } = params;
        return this._client.post((0, path_1.path) `/evals/${eval_id}/runs/${runID}`, options);
    }
}
exports.Runs = Runs;
Runs.OutputItems = output_items_1.OutputItems;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/tslib.js":27,"../../../internal/utils/path.js":34,"./output-items.js":75}],77:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Files = void 0;
const resource_1 = require("../core/resource.js");
const pagination_1 = require("../core/pagination.js");
const headers_1 = require("../internal/headers.js");
const sleep_1 = require("../internal/utils/sleep.js");
const error_1 = require("../error.js");
const uploads_1 = require("../internal/uploads.js");
const path_1 = require("../internal/utils/path.js");
class Files extends resource_1.APIResource {
    /**
     * Upload a file that can be used across various endpoints. Individual files can be
     * up to 512 MB, and the size of all files uploaded by one organization can be up
     * to 100 GB.
     *
     * The Assistants API supports files up to 2 million tokens and of specific file
     * types. See the
     * [Assistants Tools guide](https://platform.openai.com/docs/assistants/tools) for
     * details.
     *
     * The Fine-tuning API only supports `.jsonl` files. The input also has certain
     * required formats for fine-tuning
     * [chat](https://platform.openai.com/docs/api-reference/fine-tuning/chat-input) or
     * [completions](https://platform.openai.com/docs/api-reference/fine-tuning/completions-input)
     * models.
     *
     * The Batch API only supports `.jsonl` files up to 200 MB in size. The input also
     * has a specific required
     * [format](https://platform.openai.com/docs/api-reference/batch/request-input).
     *
     * Please [contact us](https://help.openai.com/) if you need to increase these
     * storage limits.
     */
    create(body, options) {
        return this._client.post('/files', (0, uploads_1.multipartFormRequestOptions)({ body, ...options }, this._client));
    }
    /**
     * Returns information about a specific file.
     */
    retrieve(fileID, options) {
        return this._client.get((0, path_1.path) `/files/${fileID}`, options);
    }
    /**
     * Returns a list of files.
     */
    list(query = {}, options) {
        return this._client.getAPIList('/files', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Delete a file.
     */
    delete(fileID, options) {
        return this._client.delete((0, path_1.path) `/files/${fileID}`, options);
    }
    /**
     * Returns the contents of the specified file.
     */
    content(fileID, options) {
        return this._client.get((0, path_1.path) `/files/${fileID}/content`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: 'application/binary' }, options?.headers]),
            __binaryResponse: true,
        });
    }
    /**
     * Waits for the given file to be processed, default timeout is 30 mins.
     */
    async waitForProcessing(id, { pollInterval = 5000, maxWait = 30 * 60 * 1000 } = {}) {
        const TERMINAL_STATES = new Set(['processed', 'error', 'deleted']);
        const start = Date.now();
        let file = await this.retrieve(id);
        while (!file.status || !TERMINAL_STATES.has(file.status)) {
            await (0, sleep_1.sleep)(pollInterval);
            file = await this.retrieve(id);
            if (Date.now() - start > maxWait) {
                throw new error_1.APIConnectionTimeoutError({
                    message: `Giving up on waiting for file ${id} to finish processing after ${maxWait} milliseconds.`,
                });
            }
        }
        return file;
    }
}
exports.Files = Files;

},{"../core/pagination.js":9,"../core/resource.js":10,"../error.js":13,"../internal/headers.js":18,"../internal/uploads.js":28,"../internal/utils/path.js":34,"../internal/utils/sleep.js":35}],78:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Alpha = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const GradersAPI = tslib_1.__importStar(require("./graders.js"));
const graders_1 = require("./graders.js");
class Alpha extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.graders = new GradersAPI.Graders(this._client);
    }
}
exports.Alpha = Alpha;
Alpha.Graders = graders_1.Graders;

},{"../../../core/resource.js":10,"../../../internal/tslib.js":27,"./graders.js":79}],79:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Graders = void 0;
const resource_1 = require("../../../core/resource.js");
class Graders extends resource_1.APIResource {
    /**
     * Run a grader.
     *
     * @example
     * ```ts
     * const response = await client.fineTuning.alpha.graders.run({
     *   grader: {
     *     input: 'input',
     *     name: 'name',
     *     operation: 'eq',
     *     reference: 'reference',
     *     type: 'string_check',
     *   },
     *   model_sample: 'model_sample',
     * });
     * ```
     */
    run(body, options) {
        return this._client.post('/fine_tuning/alpha/graders/run', { body, ...options });
    }
    /**
     * Validate a grader.
     *
     * @example
     * ```ts
     * const response =
     *   await client.fineTuning.alpha.graders.validate({
     *     grader: {
     *       input: 'input',
     *       name: 'name',
     *       operation: 'eq',
     *       reference: 'reference',
     *       type: 'string_check',
     *     },
     *   });
     * ```
     */
    validate(body, options) {
        return this._client.post('/fine_tuning/alpha/graders/validate', { body, ...options });
    }
}
exports.Graders = Graders;

},{"../../../core/resource.js":10}],80:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Checkpoints = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const PermissionsAPI = tslib_1.__importStar(require("./permissions.js"));
const permissions_1 = require("./permissions.js");
class Checkpoints extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.permissions = new PermissionsAPI.Permissions(this._client);
    }
}
exports.Checkpoints = Checkpoints;
Checkpoints.Permissions = permissions_1.Permissions;

},{"../../../core/resource.js":10,"../../../internal/tslib.js":27,"./permissions.js":81}],81:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Permissions = void 0;
const resource_1 = require("../../../core/resource.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class Permissions extends resource_1.APIResource {
    /**
     * **NOTE:** Calling this endpoint requires an [admin API key](../admin-api-keys).
     *
     * This enables organization owners to share fine-tuned models with other projects
     * in their organization.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const permissionCreateResponse of client.fineTuning.checkpoints.permissions.create(
     *   'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
     *   { project_ids: ['string'] },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(fineTunedModelCheckpoint, body, options) {
        return this._client.getAPIList((0, path_1.path) `/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, (pagination_1.Page), { body, method: 'post', ...options });
    }
    /**
     * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
     *
     * Organization owners can use this endpoint to view all permissions for a
     * fine-tuned model checkpoint.
     *
     * @example
     * ```ts
     * const permission =
     *   await client.fineTuning.checkpoints.permissions.retrieve(
     *     'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     *   );
     * ```
     */
    retrieve(fineTunedModelCheckpoint, query = {}, options) {
        return this._client.get((0, path_1.path) `/fine_tuning/checkpoints/${fineTunedModelCheckpoint}/permissions`, {
            query,
            ...options,
        });
    }
    /**
     * **NOTE:** This endpoint requires an [admin API key](../admin-api-keys).
     *
     * Organization owners can use this endpoint to delete a permission for a
     * fine-tuned model checkpoint.
     *
     * @example
     * ```ts
     * const permission =
     *   await client.fineTuning.checkpoints.permissions.delete(
     *     'cp_zc4Q7MP6XxulcVzj4MZdwsAB',
     *     {
     *       fine_tuned_model_checkpoint:
     *         'ft:gpt-4o-mini-2024-07-18:org:weather:B7R9VjQd',
     *     },
     *   );
     * ```
     */
    delete(permissionID, params, options) {
        const { fine_tuned_model_checkpoint } = params;
        return this._client.delete((0, path_1.path) `/fine_tuning/checkpoints/${fine_tuned_model_checkpoint}/permissions/${permissionID}`, options);
    }
}
exports.Permissions = Permissions;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/utils/path.js":34}],82:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FineTuning = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const MethodsAPI = tslib_1.__importStar(require("./methods.js"));
const methods_1 = require("./methods.js");
const AlphaAPI = tslib_1.__importStar(require("./alpha/alpha.js"));
const alpha_1 = require("./alpha/alpha.js");
const CheckpointsAPI = tslib_1.__importStar(require("./checkpoints/checkpoints.js"));
const checkpoints_1 = require("./checkpoints/checkpoints.js");
const JobsAPI = tslib_1.__importStar(require("./jobs/jobs.js"));
const jobs_1 = require("./jobs/jobs.js");
class FineTuning extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.methods = new MethodsAPI.Methods(this._client);
        this.jobs = new JobsAPI.Jobs(this._client);
        this.checkpoints = new CheckpointsAPI.Checkpoints(this._client);
        this.alpha = new AlphaAPI.Alpha(this._client);
    }
}
exports.FineTuning = FineTuning;
FineTuning.Methods = methods_1.Methods;
FineTuning.Jobs = jobs_1.Jobs;
FineTuning.Checkpoints = checkpoints_1.Checkpoints;
FineTuning.Alpha = alpha_1.Alpha;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"./alpha/alpha.js":78,"./checkpoints/checkpoints.js":80,"./jobs/jobs.js":84,"./methods.js":85}],83:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Checkpoints = void 0;
const resource_1 = require("../../../core/resource.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class Checkpoints extends resource_1.APIResource {
    /**
     * List checkpoints for a fine-tuning job.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fineTuningJobCheckpoint of client.fineTuning.jobs.checkpoints.list(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(fineTuningJobID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}/checkpoints`, (pagination_1.CursorPage), { query, ...options });
    }
}
exports.Checkpoints = Checkpoints;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/utils/path.js":34}],84:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Jobs = void 0;
const tslib_1 = require("../../../internal/tslib.js");
const resource_1 = require("../../../core/resource.js");
const CheckpointsAPI = tslib_1.__importStar(require("./checkpoints.js"));
const checkpoints_1 = require("./checkpoints.js");
const pagination_1 = require("../../../core/pagination.js");
const path_1 = require("../../../internal/utils/path.js");
class Jobs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.checkpoints = new CheckpointsAPI.Checkpoints(this._client);
    }
    /**
     * Creates a fine-tuning job which begins the process of creating a new model from
     * a given dataset.
     *
     * Response includes details of the enqueued job including job status and the name
     * of the fine-tuned models once complete.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     *
     * @example
     * ```ts
     * const fineTuningJob = await client.fineTuning.jobs.create({
     *   model: 'gpt-4o-mini',
     *   training_file: 'file-abc123',
     * });
     * ```
     */
    create(body, options) {
        return this._client.post('/fine_tuning/jobs', { body, ...options });
    }
    /**
     * Get info about a fine-tuning job.
     *
     * [Learn more about fine-tuning](https://platform.openai.com/docs/guides/fine-tuning)
     *
     * @example
     * ```ts
     * const fineTuningJob = await client.fineTuning.jobs.retrieve(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * );
     * ```
     */
    retrieve(fineTuningJobID, options) {
        return this._client.get((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}`, options);
    }
    /**
     * List your organization's fine-tuning jobs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fineTuningJob of client.fineTuning.jobs.list()) {
     *   // ...
     * }
     * ```
     */
    list(query = {}, options) {
        return this._client.getAPIList('/fine_tuning/jobs', (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Immediately cancel a fine-tune job.
     *
     * @example
     * ```ts
     * const fineTuningJob = await client.fineTuning.jobs.cancel(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * );
     * ```
     */
    cancel(fineTuningJobID, options) {
        return this._client.post((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}/cancel`, options);
    }
    /**
     * Get status updates for a fine-tuning job.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const fineTuningJobEvent of client.fineTuning.jobs.listEvents(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * )) {
     *   // ...
     * }
     * ```
     */
    listEvents(fineTuningJobID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}/events`, (pagination_1.CursorPage), { query, ...options });
    }
    /**
     * Pause a fine-tune job.
     *
     * @example
     * ```ts
     * const fineTuningJob = await client.fineTuning.jobs.pause(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * );
     * ```
     */
    pause(fineTuningJobID, options) {
        return this._client.post((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}/pause`, options);
    }
    /**
     * Resume a fine-tune job.
     *
     * @example
     * ```ts
     * const fineTuningJob = await client.fineTuning.jobs.resume(
     *   'ft-AF1WoRqd3aJAHsqc9NY7iL8F',
     * );
     * ```
     */
    resume(fineTuningJobID, options) {
        return this._client.post((0, path_1.path) `/fine_tuning/jobs/${fineTuningJobID}/resume`, options);
    }
}
exports.Jobs = Jobs;
Jobs.Checkpoints = checkpoints_1.Checkpoints;

},{"../../../core/pagination.js":9,"../../../core/resource.js":10,"../../../internal/tslib.js":27,"../../../internal/utils/path.js":34,"./checkpoints.js":83}],85:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Methods = void 0;
const resource_1 = require("../../core/resource.js");
class Methods extends resource_1.APIResource {
}
exports.Methods = Methods;

},{"../../core/resource.js":10}],86:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraderModels = void 0;
const resource_1 = require("../../core/resource.js");
class GraderModels extends resource_1.APIResource {
}
exports.GraderModels = GraderModels;

},{"../../core/resource.js":10}],87:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Graders = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const GraderModelsAPI = tslib_1.__importStar(require("./grader-models.js"));
const grader_models_1 = require("./grader-models.js");
class Graders extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.graderModels = new GraderModelsAPI.GraderModels(this._client);
    }
}
exports.Graders = Graders;
Graders.GraderModels = grader_models_1.GraderModels;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"./grader-models.js":86}],88:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Images = void 0;
const resource_1 = require("../core/resource.js");
const uploads_1 = require("../internal/uploads.js");
class Images extends resource_1.APIResource {
    /**
     * Creates a variation of a given image. This endpoint only supports `dall-e-2`.
     *
     * @example
     * ```ts
     * const imagesResponse = await client.images.createVariation({
     *   image: fs.createReadStream('otter.png'),
     * });
     * ```
     */
    createVariation(body, options) {
        return this._client.post('/images/variations', (0, uploads_1.multipartFormRequestOptions)({ body, ...options }, this._client));
    }
    /**
     * Creates an edited or extended image given one or more source images and a
     * prompt. This endpoint only supports `gpt-image-1` and `dall-e-2`.
     *
     * @example
     * ```ts
     * const imagesResponse = await client.images.edit({
     *   image: fs.createReadStream('path/to/file'),
     *   prompt: 'A cute baby sea otter wearing a beret',
     * });
     * ```
     */
    edit(body, options) {
        return this._client.post('/images/edits', (0, uploads_1.multipartFormRequestOptions)({ body, ...options }, this._client));
    }
    /**
     * Creates an image given a prompt.
     * [Learn more](https://platform.openai.com/docs/guides/images).
     *
     * @example
     * ```ts
     * const imagesResponse = await client.images.generate({
     *   prompt: 'A cute baby sea otter',
     * });
     * ```
     */
    generate(body, options) {
        return this._client.post('/images/generations', { body, ...options });
    }
}
exports.Images = Images;

},{"../core/resource.js":10,"../internal/uploads.js":28}],89:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStores = exports.Uploads = exports.Responses = exports.Moderations = exports.Models = exports.Images = exports.Graders = exports.FineTuning = exports.Files = exports.Evals = exports.Embeddings = exports.Containers = exports.Completions = exports.Beta = exports.Batches = exports.Audio = void 0;
const tslib_1 = require("../internal/tslib.js");
tslib_1.__exportStar(require("./chat/index.js"), exports);
tslib_1.__exportStar(require("./shared.js"), exports);
var audio_1 = require("./audio/audio.js");
Object.defineProperty(exports, "Audio", { enumerable: true, get: function () { return audio_1.Audio; } });
var batches_1 = require("./batches.js");
Object.defineProperty(exports, "Batches", { enumerable: true, get: function () { return batches_1.Batches; } });
var beta_1 = require("./beta/beta.js");
Object.defineProperty(exports, "Beta", { enumerable: true, get: function () { return beta_1.Beta; } });
var completions_1 = require("./completions.js");
Object.defineProperty(exports, "Completions", { enumerable: true, get: function () { return completions_1.Completions; } });
var containers_1 = require("./containers/containers.js");
Object.defineProperty(exports, "Containers", { enumerable: true, get: function () { return containers_1.Containers; } });
var embeddings_1 = require("./embeddings.js");
Object.defineProperty(exports, "Embeddings", { enumerable: true, get: function () { return embeddings_1.Embeddings; } });
var evals_1 = require("./evals/evals.js");
Object.defineProperty(exports, "Evals", { enumerable: true, get: function () { return evals_1.Evals; } });
var files_1 = require("./files.js");
Object.defineProperty(exports, "Files", { enumerable: true, get: function () { return files_1.Files; } });
var fine_tuning_1 = require("./fine-tuning/fine-tuning.js");
Object.defineProperty(exports, "FineTuning", { enumerable: true, get: function () { return fine_tuning_1.FineTuning; } });
var graders_1 = require("./graders/graders.js");
Object.defineProperty(exports, "Graders", { enumerable: true, get: function () { return graders_1.Graders; } });
var images_1 = require("./images.js");
Object.defineProperty(exports, "Images", { enumerable: true, get: function () { return images_1.Images; } });
var models_1 = require("./models.js");
Object.defineProperty(exports, "Models", { enumerable: true, get: function () { return models_1.Models; } });
var moderations_1 = require("./moderations.js");
Object.defineProperty(exports, "Moderations", { enumerable: true, get: function () { return moderations_1.Moderations; } });
var responses_1 = require("./responses/responses.js");
Object.defineProperty(exports, "Responses", { enumerable: true, get: function () { return responses_1.Responses; } });
var uploads_1 = require("./uploads/uploads.js");
Object.defineProperty(exports, "Uploads", { enumerable: true, get: function () { return uploads_1.Uploads; } });
var vector_stores_1 = require("./vector-stores/vector-stores.js");
Object.defineProperty(exports, "VectorStores", { enumerable: true, get: function () { return vector_stores_1.VectorStores; } });

},{"../internal/tslib.js":27,"./audio/audio.js":50,"./batches.js":54,"./beta/beta.js":56,"./chat/index.js":68,"./completions.js":69,"./containers/containers.js":70,"./embeddings.js":73,"./evals/evals.js":74,"./files.js":77,"./fine-tuning/fine-tuning.js":82,"./graders/graders.js":87,"./images.js":88,"./models.js":90,"./moderations.js":91,"./responses/responses.js":93,"./shared.js":94,"./uploads/uploads.js":96,"./vector-stores/vector-stores.js":99}],90:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Models = void 0;
const resource_1 = require("../core/resource.js");
const pagination_1 = require("../core/pagination.js");
const path_1 = require("../internal/utils/path.js");
class Models extends resource_1.APIResource {
    /**
     * Retrieves a model instance, providing basic information about the model such as
     * the owner and permissioning.
     */
    retrieve(model, options) {
        return this._client.get((0, path_1.path) `/models/${model}`, options);
    }
    /**
     * Lists the currently available models, and provides basic information about each
     * one such as the owner and availability.
     */
    list(options) {
        return this._client.getAPIList('/models', (pagination_1.Page), options);
    }
    /**
     * Delete a fine-tuned model. You must have the Owner role in your organization to
     * delete a model.
     */
    delete(model, options) {
        return this._client.delete((0, path_1.path) `/models/${model}`, options);
    }
}
exports.Models = Models;

},{"../core/pagination.js":9,"../core/resource.js":10,"../internal/utils/path.js":34}],91:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Moderations = void 0;
const resource_1 = require("../core/resource.js");
class Moderations extends resource_1.APIResource {
    /**
     * Classifies if text and/or image inputs are potentially harmful. Learn more in
     * the [moderation guide](https://platform.openai.com/docs/guides/moderation).
     */
    create(body, options) {
        return this._client.post('/moderations', { body, ...options });
    }
}
exports.Moderations = Moderations;

},{"../core/resource.js":10}],92:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.InputItems = void 0;
const resource_1 = require("../../core/resource.js");
const pagination_1 = require("../../core/pagination.js");
const path_1 = require("../../internal/utils/path.js");
class InputItems extends resource_1.APIResource {
    /**
     * Returns a list of input items for a given response.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const responseItem of client.responses.inputItems.list(
     *   'response_id',
     * )) {
     *   // ...
     * }
     * ```
     */
    list(responseID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/responses/${responseID}/input_items`, (pagination_1.CursorPage), { query, ...options });
    }
}
exports.InputItems = InputItems;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/utils/path.js":34}],93:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Responses = void 0;
const tslib_1 = require("../../internal/tslib.js");
const ResponsesParser_1 = require("../../lib/ResponsesParser.js");
const ResponseStream_1 = require("../../lib/responses/ResponseStream.js");
const resource_1 = require("../../core/resource.js");
const InputItemsAPI = tslib_1.__importStar(require("./input-items.js"));
const input_items_1 = require("./input-items.js");
const headers_1 = require("../../internal/headers.js");
const path_1 = require("../../internal/utils/path.js");
class Responses extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.inputItems = new InputItemsAPI.InputItems(this._client);
    }
    create(body, options) {
        return this._client.post('/responses', { body, ...options, stream: body.stream ?? false })._thenUnwrap((rsp) => {
            if ('object' in rsp && rsp.object === 'response') {
                (0, ResponsesParser_1.addOutputText)(rsp);
            }
            return rsp;
        });
    }
    retrieve(responseID, query = {}, options) {
        return this._client.get((0, path_1.path) `/responses/${responseID}`, {
            query,
            ...options,
            stream: query?.stream ?? false,
        });
    }
    /**
     * Deletes a model response with the given ID.
     *
     * @example
     * ```ts
     * await client.responses.delete(
     *   'resp_677efb5139a88190b512bc3fef8e535d',
     * );
     * ```
     */
    delete(responseID, options) {
        return this._client.delete((0, path_1.path) `/responses/${responseID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ Accept: '*/*' }, options?.headers]),
        });
    }
    parse(body, options) {
        return this._client.responses
            .create(body, options)
            ._thenUnwrap((response) => (0, ResponsesParser_1.parseResponse)(response, body));
    }
    /**
     * Creates a model response stream
     */
    stream(body, options) {
        return ResponseStream_1.ResponseStream.createResponse(this._client, body, options);
    }
    /**
     * Cancels a model response with the given ID. Only responses created with the
     * `background` parameter set to `true` can be cancelled.
     * [Learn more](https://platform.openai.com/docs/guides/background).
     *
     * @example
     * ```ts
     * const response = await client.responses.cancel(
     *   'resp_677efb5139a88190b512bc3fef8e535d',
     * );
     * ```
     */
    cancel(responseID, options) {
        return this._client.post((0, path_1.path) `/responses/${responseID}/cancel`, options);
    }
}
exports.Responses = Responses;
Responses.InputItems = input_items_1.InputItems;

},{"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/tslib.js":27,"../../internal/utils/path.js":34,"../../lib/ResponsesParser.js":44,"../../lib/responses/ResponseStream.js":49,"./input-items.js":92}],94:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });

},{}],95:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parts = void 0;
const resource_1 = require("../../core/resource.js");
const uploads_1 = require("../../internal/uploads.js");
const path_1 = require("../../internal/utils/path.js");
class Parts extends resource_1.APIResource {
    /**
     * Adds a
     * [Part](https://platform.openai.com/docs/api-reference/uploads/part-object) to an
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object.
     * A Part represents a chunk of bytes from the file you are trying to upload.
     *
     * Each Part can be at most 64 MB, and you can add Parts until you hit the Upload
     * maximum of 8 GB.
     *
     * It is possible to add multiple Parts in parallel. You can decide the intended
     * order of the Parts when you
     * [complete the Upload](https://platform.openai.com/docs/api-reference/uploads/complete).
     */
    create(uploadID, body, options) {
        return this._client.post((0, path_1.path) `/uploads/${uploadID}/parts`, (0, uploads_1.multipartFormRequestOptions)({ body, ...options }, this._client));
    }
}
exports.Parts = Parts;

},{"../../core/resource.js":10,"../../internal/uploads.js":28,"../../internal/utils/path.js":34}],96:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Uploads = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const PartsAPI = tslib_1.__importStar(require("./parts.js"));
const parts_1 = require("./parts.js");
const path_1 = require("../../internal/utils/path.js");
class Uploads extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.parts = new PartsAPI.Parts(this._client);
    }
    /**
     * Creates an intermediate
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object) object
     * that you can add
     * [Parts](https://platform.openai.com/docs/api-reference/uploads/part-object) to.
     * Currently, an Upload can accept at most 8 GB in total and expires after an hour
     * after you create it.
     *
     * Once you complete the Upload, we will create a
     * [File](https://platform.openai.com/docs/api-reference/files/object) object that
     * contains all the parts you uploaded. This File is usable in the rest of our
     * platform as a regular File object.
     *
     * For certain `purpose` values, the correct `mime_type` must be specified. Please
     * refer to documentation for the
     * [supported MIME types for your use case](https://platform.openai.com/docs/assistants/tools/file-search#supported-files).
     *
     * For guidance on the proper filename extensions for each purpose, please follow
     * the documentation on
     * [creating a File](https://platform.openai.com/docs/api-reference/files/create).
     */
    create(body, options) {
        return this._client.post('/uploads', { body, ...options });
    }
    /**
     * Cancels the Upload. No Parts may be added after an Upload is cancelled.
     */
    cancel(uploadID, options) {
        return this._client.post((0, path_1.path) `/uploads/${uploadID}/cancel`, options);
    }
    /**
     * Completes the
     * [Upload](https://platform.openai.com/docs/api-reference/uploads/object).
     *
     * Within the returned Upload object, there is a nested
     * [File](https://platform.openai.com/docs/api-reference/files/object) object that
     * is ready to use in the rest of the platform.
     *
     * You can specify the order of the Parts by passing in an ordered list of the Part
     * IDs.
     *
     * The number of bytes uploaded upon completion must match the number of bytes
     * initially specified when creating the Upload object. No Parts may be added after
     * an Upload is completed.
     */
    complete(uploadID, body, options) {
        return this._client.post((0, path_1.path) `/uploads/${uploadID}/complete`, { body, ...options });
    }
}
exports.Uploads = Uploads;
Uploads.Parts = parts_1.Parts;

},{"../../core/resource.js":10,"../../internal/tslib.js":27,"../../internal/utils/path.js":34,"./parts.js":95}],97:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileBatches = void 0;
const resource_1 = require("../../core/resource.js");
const pagination_1 = require("../../core/pagination.js");
const headers_1 = require("../../internal/headers.js");
const sleep_1 = require("../../internal/utils/sleep.js");
const Util_1 = require("../../lib/Util.js");
const path_1 = require("../../internal/utils/path.js");
class FileBatches extends resource_1.APIResource {
    /**
     * Create a vector store file batch.
     */
    create(vectorStoreID, body, options) {
        return this._client.post((0, path_1.path) `/vector_stores/${vectorStoreID}/file_batches`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieves a vector store file batch.
     */
    retrieve(batchID, params, options) {
        const { vector_store_id } = params;
        return this._client.get((0, path_1.path) `/vector_stores/${vector_store_id}/file_batches/${batchID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Cancel a vector store file batch. This attempts to cancel the processing of
     * files in this batch as soon as possible.
     */
    cancel(batchID, params, options) {
        const { vector_store_id } = params;
        return this._client.post((0, path_1.path) `/vector_stores/${vector_store_id}/file_batches/${batchID}/cancel`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Create a vector store batch and poll until all files have been processed.
     */
    async createAndPoll(vectorStoreId, body, options) {
        const batch = await this.create(vectorStoreId, body);
        return await this.poll(vectorStoreId, batch.id, options);
    }
    /**
     * Returns a list of vector store files in a batch.
     */
    listFiles(batchID, params, options) {
        const { vector_store_id, ...query } = params;
        return this._client.getAPIList((0, path_1.path) `/vector_stores/${vector_store_id}/file_batches/${batchID}/files`, (pagination_1.CursorPage), { query, ...options, headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]) });
    }
    /**
     * Wait for the given file batch to be processed.
     *
     * Note: this will return even if one of the files failed to process, you need to
     * check batch.file_counts.failed_count to handle this case.
     */
    async poll(vectorStoreID, batchID, options) {
        const headers = (0, headers_1.buildHeaders)([
            options?.headers,
            {
                'X-Stainless-Poll-Helper': 'true',
                'X-Stainless-Custom-Poll-Interval': options?.pollIntervalMs?.toString() ?? undefined,
            },
        ]);
        while (true) {
            const { data: batch, response } = await this.retrieve(batchID, { vector_store_id: vectorStoreID }, {
                ...options,
                headers,
            }).withResponse();
            switch (batch.status) {
                case 'in_progress':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0, sleep_1.sleep)(sleepInterval);
                    break;
                case 'failed':
                case 'cancelled':
                case 'completed':
                    return batch;
            }
        }
    }
    /**
     * Uploads the given files concurrently and then creates a vector store file batch.
     *
     * The concurrency limit is configurable using the `maxConcurrency` parameter.
     */
    async uploadAndPoll(vectorStoreId, { files, fileIds = [] }, options) {
        if (files == null || files.length == 0) {
            throw new Error(`No \`files\` provided to process. If you've already uploaded files you should use \`.createAndPoll()\` instead`);
        }
        const configuredConcurrency = options?.maxConcurrency ?? 5;
        // We cap the number of workers at the number of files (so we don't start any unnecessary workers)
        const concurrencyLimit = Math.min(configuredConcurrency, files.length);
        const client = this._client;
        const fileIterator = files.values();
        const allFileIds = [...fileIds];
        // This code is based on this design. The libraries don't accommodate our environment limits.
        // https://stackoverflow.com/questions/40639432/what-is-the-best-way-to-limit-concurrency-when-using-es6s-promise-all
        async function processFiles(iterator) {
            for (let item of iterator) {
                const fileObj = await client.files.create({ file: item, purpose: 'assistants' }, options);
                allFileIds.push(fileObj.id);
            }
        }
        // Start workers to process results
        const workers = Array(concurrencyLimit).fill(fileIterator).map(processFiles);
        // Wait for all processing to complete.
        await (0, Util_1.allSettledWithThrow)(workers);
        return await this.createAndPoll(vectorStoreId, {
            file_ids: allFileIds,
        });
    }
}
exports.FileBatches = FileBatches;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/utils/path.js":34,"../../internal/utils/sleep.js":35,"../../lib/Util.js":46}],98:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Files = void 0;
const resource_1 = require("../../core/resource.js");
const pagination_1 = require("../../core/pagination.js");
const headers_1 = require("../../internal/headers.js");
const utils_1 = require("../../internal/utils.js");
const path_1 = require("../../internal/utils/path.js");
class Files extends resource_1.APIResource {
    /**
     * Create a vector store file by attaching a
     * [File](https://platform.openai.com/docs/api-reference/files) to a
     * [vector store](https://platform.openai.com/docs/api-reference/vector-stores/object).
     */
    create(vectorStoreID, body, options) {
        return this._client.post((0, path_1.path) `/vector_stores/${vectorStoreID}/files`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieves a vector store file.
     */
    retrieve(fileID, params, options) {
        const { vector_store_id } = params;
        return this._client.get((0, path_1.path) `/vector_stores/${vector_store_id}/files/${fileID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Update attributes on a vector store file.
     */
    update(fileID, params, options) {
        const { vector_store_id, ...body } = params;
        return this._client.post((0, path_1.path) `/vector_stores/${vector_store_id}/files/${fileID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of vector store files.
     */
    list(vectorStoreID, query = {}, options) {
        return this._client.getAPIList((0, path_1.path) `/vector_stores/${vectorStoreID}/files`, (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Delete a vector store file. This will remove the file from the vector store but
     * the file itself will not be deleted. To delete the file, use the
     * [delete file](https://platform.openai.com/docs/api-reference/files/delete)
     * endpoint.
     */
    delete(fileID, params, options) {
        const { vector_store_id } = params;
        return this._client.delete((0, path_1.path) `/vector_stores/${vector_store_id}/files/${fileID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Attach a file to the given vector store and wait for it to be processed.
     */
    async createAndPoll(vectorStoreId, body, options) {
        const file = await this.create(vectorStoreId, body, options);
        return await this.poll(vectorStoreId, file.id, options);
    }
    /**
     * Wait for the vector store file to finish processing.
     *
     * Note: this will return even if the file failed to process, you need to check
     * file.last_error and file.status to handle these cases
     */
    async poll(vectorStoreID, fileID, options) {
        const headers = (0, headers_1.buildHeaders)([
            options?.headers,
            {
                'X-Stainless-Poll-Helper': 'true',
                'X-Stainless-Custom-Poll-Interval': options?.pollIntervalMs?.toString() ?? undefined,
            },
        ]);
        while (true) {
            const fileResponse = await this.retrieve(fileID, {
                vector_store_id: vectorStoreID,
            }, { ...options, headers }).withResponse();
            const file = fileResponse.data;
            switch (file.status) {
                case 'in_progress':
                    let sleepInterval = 5000;
                    if (options?.pollIntervalMs) {
                        sleepInterval = options.pollIntervalMs;
                    }
                    else {
                        const headerInterval = fileResponse.response.headers.get('openai-poll-after-ms');
                        if (headerInterval) {
                            const headerIntervalMs = parseInt(headerInterval);
                            if (!isNaN(headerIntervalMs)) {
                                sleepInterval = headerIntervalMs;
                            }
                        }
                    }
                    await (0, utils_1.sleep)(sleepInterval);
                    break;
                case 'failed':
                case 'completed':
                    return file;
            }
        }
    }
    /**
     * Upload a file to the `files` API and then attach it to the given vector store.
     *
     * Note the file will be asynchronously processed (you can use the alternative
     * polling helper method to wait for processing to complete).
     */
    async upload(vectorStoreId, file, options) {
        const fileInfo = await this._client.files.create({ file: file, purpose: 'assistants' }, options);
        return this.create(vectorStoreId, { file_id: fileInfo.id }, options);
    }
    /**
     * Add a file to a vector store and poll until processing is complete.
     */
    async uploadAndPoll(vectorStoreId, file, options) {
        const fileInfo = await this.upload(vectorStoreId, file, options);
        return await this.poll(vectorStoreId, fileInfo.id, options);
    }
    /**
     * Retrieve the parsed contents of a vector store file.
     */
    content(fileID, params, options) {
        const { vector_store_id } = params;
        return this._client.getAPIList((0, path_1.path) `/vector_stores/${vector_store_id}/files/${fileID}/content`, (pagination_1.Page), { ...options, headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]) });
    }
}
exports.Files = Files;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/utils.js":29,"../../internal/utils/path.js":34}],99:[function(require,module,exports){
"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorStores = void 0;
const tslib_1 = require("../../internal/tslib.js");
const resource_1 = require("../../core/resource.js");
const FileBatchesAPI = tslib_1.__importStar(require("./file-batches.js"));
const file_batches_1 = require("./file-batches.js");
const FilesAPI = tslib_1.__importStar(require("./files.js"));
const files_1 = require("./files.js");
const pagination_1 = require("../../core/pagination.js");
const headers_1 = require("../../internal/headers.js");
const path_1 = require("../../internal/utils/path.js");
class VectorStores extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.files = new FilesAPI.Files(this._client);
        this.fileBatches = new FileBatchesAPI.FileBatches(this._client);
    }
    /**
     * Create a vector store.
     */
    create(body, options) {
        return this._client.post('/vector_stores', {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Retrieves a vector store.
     */
    retrieve(vectorStoreID, options) {
        return this._client.get((0, path_1.path) `/vector_stores/${vectorStoreID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Modifies a vector store.
     */
    update(vectorStoreID, body, options) {
        return this._client.post((0, path_1.path) `/vector_stores/${vectorStoreID}`, {
            body,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Returns a list of vector stores.
     */
    list(query = {}, options) {
        return this._client.getAPIList('/vector_stores', (pagination_1.CursorPage), {
            query,
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Delete a vector store.
     */
    delete(vectorStoreID, options) {
        return this._client.delete((0, path_1.path) `/vector_stores/${vectorStoreID}`, {
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
    /**
     * Search a vector store for relevant chunks based on a query and file attributes
     * filter.
     */
    search(vectorStoreID, body, options) {
        return this._client.getAPIList((0, path_1.path) `/vector_stores/${vectorStoreID}/search`, (pagination_1.Page), {
            body,
            method: 'post',
            ...options,
            headers: (0, headers_1.buildHeaders)([{ 'OpenAI-Beta': 'assistants=v2' }, options?.headers]),
        });
    }
}
exports.VectorStores = VectorStores;
VectorStores.Files = files_1.Files;
VectorStores.FileBatches = file_batches_1.FileBatches;

},{"../../core/pagination.js":9,"../../core/resource.js":10,"../../internal/headers.js":18,"../../internal/tslib.js":27,"../../internal/utils/path.js":34,"./file-batches.js":97,"./files.js":98}],100:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("./internal/tslib.js");
/** @deprecated Import from ./core/streaming instead */
tslib_1.__exportStar(require("./core/streaming.js"), exports);

},{"./core/streaming.js":11,"./internal/tslib.js":27}],101:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VERSION = void 0;
exports.VERSION = '5.1.1'; // x-release-please-version

},{}],102:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],103:[function(require,module,exports){
var OpenAI = require("openai")
module.exports = {
	OpenAI
}
},{"openai":14}]},{},[103])(103)
});
