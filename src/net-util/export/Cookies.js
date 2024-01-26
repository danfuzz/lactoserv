// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration, Moment } from '@this/data-values';
import { MustBe } from '@this/typey';


/**
 * Holder of sets of cookies, either for a request or a response, along with
 * related parsing and utility functionality.
 *
 * **Note:** See <https://www.rfc-editor.org/info/rfc6265> for the RFC spec.
 */
export class Cookies {
  /** @type {Map<string, string>} Map from each cookie name to its value. */
  #cookies = new Map();

  /**
   * @type {Map<string, object>} Map from each cookie name to its attributes
   * for use as `Set-Cookie` headers.
   */
  #attributes = new Map();

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
   * Gets a map-like iterator of cookie values. Each entry is a two-element
   * array of a name and corresponding value.
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
  getValue(name) {
    const result = this.getValueOrNull(name);

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
  getValueOrNull(name) {
    return this.#cookies.get(name) ?? null;
  }

  /**
   * Adds or replaces a cookie.
   *
   * @param {string} name Cookie name.
   * @param {string} value Cookie value.
   * @param {?object} [attributes] Attributes, when being used as a `Set-Cookie`
   *   response header. Attribute names are the lowerCamelCase version of the
   *   name as defined by the cookie spec (e.g., `maxAge` for `Max-Age` and
   *   `httpOnly` for `HttpOnly`). Attribute types are `boolean` for no-value
   *   attributes, and vary for the others.
   */
  set(name, value, attributes = null) {
    MustBe.string(name, Cookies.#NAME_REGEX);
    MustBe.string(value, Cookies.#VALUE_REGEX);
    if (attributes) {
      Cookies.#checkAttributes(attributes);
    }

    if (Object.isFrozen(this)) {
      throw new Error('Frozen instance.');
    }

    this.#setUnchecked(name, value, attributes);
  }

  /**
   * Like {@link #set}, but without the checks. This allows for {@link #parse}
   * to construct instances without redundant argument checks.
   *
   * @param {string} name Cookie name.
   * @param {string} value Cookie value.
   * @param {?object} attributes Attributes.
   */
  #setUnchecked(name, value, attributes) {
    this.#cookies.set(name, value);

    if (attributes) {
      this.#attributes.set(name, attributes);
    }
  }


  //
  // Static members
  //

  /**
   * @type {RegExp} Regex which matches a cookie name. This is derived from the
   * definition of `cookie-name` in RFC6265, which is in terms of the definition
   * of `token` in RFC2616.
   */
  static #NAME_REGEX;

  /**
   * @type {RegExp} Regex which matches a cookie value, either with or without
   * surrounding quotes. This is derived from the definition of `cookie-value`
   * in RFC6265.
   */
  static #VALUE_REGEX;

  /** @type {RegExp} Regex which matches a cookie assignment, unanchored. */
  static #ASSIGN_REGEX;

  static {
    // Note: This uses the (as of this writing) relatively new `/v` regex mode,
    // which enables set operations inside character classes (`[...]`).

    const nameRx  = '[[\\x21-\\x7f]--[\\[\\]\\\\\\(\\)<>\\{\\}@,;:"=]]+';
    const valueRx = '[[\\x21-\\x7f]--[\\\\,;"]]*';

    this.#NAME_REGEX  = Object.freeze(new RegExp(`^${nameRx}$`, 'v'));
    this.#VALUE_REGEX = Object.freeze(new RegExp(`^${valueRx}$`, 'v'));

    // Note: The negative assertion `(?!")` in `<value1>` seems to be necessary,
    // even though the "longest match" rule should have let the `<value2>`
    // alternative "win" when a quoted form is present.
    this.#ASSIGN_REGEX = Object.freeze(
      new RegExp(''
        + `(?<name>${nameRx})=`
        + `(?:(?<value1>(?!")${valueRx})|"(?<value2>${valueRx})")`
        + `(?: *;| *$)`, 'gv'));
  }

  /** @type {Cookies} Standard frozen empty instance of this class. */
  static #EMPTY = new Cookies();
  static {
    Object.freeze(this.#EMPTY);
  }

  /** @returns {Cookies} Standard frozen empty instance of this class. */
  static get EMPTY() {
    return this.#EMPTY;
  }

  /**
   * Parses a `Cookie` header, and constructs an instance based on the contents.
   * Cookie values are interpreted using the global function
   * `decodeURIComponent()`; if that function reports an error, then the
   * corresponding cookie is not included in the result.
   *
   * This method takes a strict view of what is valid syntax for a cookie
   * assignment (including allowed characters), but it is lenient with respect
   * how those assignments are delimited.
   *
   * @param {string} header The header to parse.
   * @returns {?Cookies} Constructed instance, or `null` if there was an error
   *   parsing `header` such that no cookies at all could be found.
   */
  static parse(header) {
    MustBe.string(header);

    let result = null;

    for (const { groups } of header.matchAll(this.#ASSIGN_REGEX)) {
      const { name, value1, value2 } = groups;
      const value = value1 ?? value2;

      try {
        const decoded = decodeURIComponent(value);

        if (!result) {
          result = new Cookies();
        }

        result.#setUnchecked(name, decoded);
      } catch (e) {
        // Ignore it, but don't add a cookie to the result.
      }
    }

    return result;
  }

  /**
   * Validates a cookie attributes object.
   *
   * @param {object} attributes The attributes.
   * @returns {object} `attributes` iff valid.
   * @throws {Error} Thrown if there is a problem with `attributes`.
   */
  static #checkAttributes(attributes) {
    MustBe.plainObject(attributes);

    for (const [name, value] of Object.entries(attributes)) {
      switch (name) {
        case 'httpOnly':
        case 'partitioned':
        case 'secure': {
          MustBe.boolean(value);
          break;
        }

        case 'domain':
        case 'path': {
          MustBe.string(value);
          break;
        }

        case 'expires': {
          MustBe.instanceOf(value, Moment);
          break;
        }

        case 'maxAge': {
          MustBe.instanceOf(value, Duration);
          break;
        }

        case 'sameSite': {
          MustBe.string(value, /^(strict|lax|none)$/);
          break;
        }

        default: {
          throw new Error(`Unknown cookie attribute: ${name}`);
        }
      }
    }

    return attributes;
  }
}
