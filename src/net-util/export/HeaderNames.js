// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utility class for canonicalization of HTTP(ish) header names.
 */
export class HeaderNames {
  /**
   * @type {Map<string, string>} Mapping from arbitrarily-cased header names to
   * their modern (downcased) versions. Seeded proactively and then lazily
   * accumulated.
   */
  static #ANY_TO_MODERN = new Map();

  /**
   * @type {Map<string, string>} Mapping from arbitrarily-cased header names to
   * their classic version (mostly capitalized though with some exceptions).
   * Seeded proactively and then lazily accumulated.
   */
  static #ANY_TO_CLASSIC = new Map();

  static {
    const add = (classic) => {
      const modern = classic.toLowerCase();
      this.#ANY_TO_MODERN.set(classic, modern);
      this.#ANY_TO_MODERN.set(modern, modern);
      this.#ANY_TO_CLASSIC.set(modern, classic);
      this.#ANY_TO_CLASSIC.set(classic, classic);
    };

    add('Accept-Ranges');
    add('Cache-Control');
    add('Connection');
    add('Content-Length');
    add('Content-Type');
    add('Cookie');
    add('Date');
    add('ETag');
    add('Keep-Alive');
    add('Last-Modified');
    add('Location');
    add('Server');
    add('Set-Cookie');
  }

  /**
   * Given a header name in any casing, return the classic casing. Classic
   * casing is _mostly_ capitalized at dashes, but `ETag` is a notable
   * exception.
   *
   * **Note:** This implementation does not know about all the exceptions. If
   * there is an exception which, in practice, is common enough to worry about,
   * this class can (and should) be updated. That said, because headers are
   * case-ignored, missing cases are not expected to cause actual problems
   * (beyond mild developer annoyance).
   *
   * @param {string} orig The original header name.
   * @returns {string} The modern casing for same.
   */
  static classicFrom(orig) {
    const already = this.#ANY_TO_CLASSIC.get(orig);

    if (already) {
      return already;
    }

    // If it's an exception, it will be in the `ANY_TO_CLASSIC` table, mapped
    // from the modern version. So we check that first before manually
    // transforming the string.
    const modern   = this.modernFrom(orig);
    const already2 = this.#ANY_TO_CLASSIC.get(modern);

    if (already2) {
      return already2;
    }

    const chars = [...modern];

    for (let i = 0; i < chars.length; i++) {
      if ((i === 0) || (chars[i - 1] === '-')) {
        chars[i] = chars[i].toUpperCase();
      }
    }

    const result = chars.join('');

    this.#ANY_TO_CLASSIC.set(orig, result);

    return result;
  }

  /**
   * Given a header name in any casing, return the canonical modern casing,
   * which is to say fully downcased.
   *
   * @param {string} orig The original header name.
   * @returns {string} The modern casing for same.
   */
  static modernFrom(orig) {
    const already = this.#ANY_TO_MODERN.get(orig);

    if (already) {
      return already;
    } else {
      const result = orig.toLowerCase();
      this.#ANY_TO_MODERN.set(orig, result);
      return result;
    }
  }
}
