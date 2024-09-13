// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utilities for encoding and decoding base64url strings.
 *
 * It is the year 2024. And yet -- somehow -- writing a new base64 encoder turns
 * out to be the best of the available options. Notably, this class is meant to
 * be able to be used as-is in a client (browser) context.
 *
 * This implementation is based on RFC4648, specifically the base64url variant
 * which replaces the encoding characters `+/` with `-_` (respectively). This
 * encoding also omits the trailing `=`s which would have been included with the
 * usual base64 encoding, if any.
 */
export class Base64Url {
  //
  // Static members
  //

  /**
   * The encoding character set, in order.
   *
   * @type {string}
   */
  static #CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

  /**
   * Map from encoded characters to their corresponding decoded values.
   *
   * @type {RegExp}
   */
  static #DECODE_MAP = new Map();
  static {
    const CHARSET = this.#CHARSET;
    const MAP     = this.#DECODE_MAP;

    for (let i = 0; i < CHARSET.length; i++) {
      MAP.set(CHARSET[i], i);
    }
  }

  /**
   * Decodes a base64url string into a byte array.
   *
   * @param {string} encoded The encoded form.
   * @returns {Uint8Array} The decoded array.
   */
  static decode(encoded) {
    const MAP          = this.#DECODE_MAP;
    const result       = new Uint8Array(encoded.length);
    let   at           = 0;
    let   pendingBits  = 0;
    let   pendingValue = 0;

    for (const c of encoded) {
      const decoded = MAP.get(c);
      if (decoded !== undefined) {
        pendingValue = (pendingValue << 6) | decoded;
        pendingBits += 6;
        if (pendingBits >= 8) {
          result[at] = (pendingValue >> (pendingBits - 8));
          pendingValue &= (1 << (pendingBits - 8)) - 1;
          pendingBits -= 8;
          at++;
        }
      }
    }

    return (at === result.length)
      ? result
      : result.subarray(0, at);
  }

  /**
   * Encodes a byte array into base64url.
   *
   * @param {ArrayBuffer|Uint8Array} bytes The byte array to encode.
   * @returns {string} The encoded form.
   */
  static encode(bytes) {
    if (bytes instanceof ArrayBuffer) {
      bytes = new Uint8Array(bytes);
    }

    // Note: This code is meant to be usable in a browser, so we can't use
    // Node's `Buffer` class.

    const inLen     = bytes.length;
    const resultLen = Math.ceil((inLen * 8) / 6);
    const encoded   = new Array(resultLen);
    const CHARSET   = this.#CHARSET;

    let inAt         = 0;
    let pendingBits  = 0;
    let pendingValue = 0;
    for (let outAt = 0; outAt < resultLen; outAt++) {
      if (pendingBits < 6) {
        pendingValue <<= 8;
        pendingValue |= (inAt < inLen) ? bytes[inAt++] : 0;
        pendingBits += 8;
      }

      const charsetIndex = (pendingValue >> (pendingBits - 6)) & 0x3f;

      encoded[outAt] = CHARSET[charsetIndex];
      pendingBits -= 6;
    }

    return encoded.join('');
  }
}
