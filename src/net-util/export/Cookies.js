// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import cookie from 'cookie';

import { MustBe } from '@this/typey';


/**
 * Holder of sets of cookies, either for a request or a response, along with
 * related parsing and utility functionality.
 */
export class Cookies {
  /** @type {Map<string, string>} Map from each cookie name to its value. */
  #cookies = new Map();

  /**
   * Constructs an empty instance.
   */
  constructor() {
    // This space intentionally left blank.
  }

  /** @returns {number} How many cookies are in this instance. */
  get size() {
    return this.#cookies.size;
  }

  /**
   * Standard iteration protocol method. This is the same as calling {@link
   * #entries}.
   *
   * @returns {object} Iterator over the entries of this instance.
   */
  [Symbol.iterator]() {
    return this.entries();
  }

  /**
   * Gets the iterator of the cookies in this instance. Each entry is a
   * two-element array of a name and corresponding value.
   *
   * @returns {object} The iterator.
   */
  entries() {
    return this.#cookies.entries();
  }

  /**
   * Gets a cookie value, which is expected to be set.
   *
   * @param {string} name Cookie name.
   * @returns {string} Cookie value.
   * @throws {Error} Thrown if `name` is not bound.
   */
  get(name) {
    const result = this.getOrNull(name);

    if (result !== null) {
      return result;
    }

    throw new Error(`No such cookie: ${name}`);
  }

  /**
   * Gets a cookie value, if available.
   *
   * @param {string} name Cookie name.
   * @returns {?string} Cookie value, or `null` if not found.
   */
  getOrNull(name) {
    return this.#cookies.get(name) ?? null;
  }

  /**
   * Adds or replaces a cookie.
   *
   * @param {string} name Cookie name.
   * @param {string} value Cookie value.
   */
  set(name, value) {
    if (Object.isFrozen(this)) {
      throw new Error('Frozen instance.');
    }

    this.#cookies.set(name, value);
  }


  //
  // Static members
  //

  /**
   * Parses a `Cookie` header, and constructs an instance based on the contents.
   * Cookie values are interpreted using the global function
   * `decodeURIComponent()`; if that function reports an error, then the
   * corresponding cookie is not included in the result.
   *
   * @param {string} header The header to parse.
   * @returns {?Cookies} Constructed instance, or `null` if there was an error
   *   parsing `header` such that no cookies at all could be found.
   */
  static parse(header) {
    MustBe.string(header);

    // Note: We use an explicit no-op decoder, because if we don't pass one
    // `cookie` will do its own URI-decoding, and its tactic for error handling
    // isn't the same as ours.
    const parsed = cookie.parse(header, { decode: (x) => x });

    let result = null;

    for (const [name, value] of Object.entries(parsed)) {
      try {
        const decoded = decodeURIComponent(value);

        if (!result) {
          result = new Cookies();
        }

        result.set(name, decoded);
      } catch (e) {
        // Ignore it, but don't add a cookie to the result.
      }
    }

    return result;
  }
}
