// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Cookies } from '#x/Cookies';
import { HttpUtil } from '#x/HttpUtil';


/**
 * Subclass of the standard global class `Headers`, with extra functionality
 * found to be useful in practice.
 */
export class HttpHeaders extends Headers {
  /**
   * Constructs an instance.
   *
   * @param {?Headers|Map|object} [other] Initial source of entries. This is
   *   allowed to be anything that implements a map-like iterator, or a plain
   *   object. If non-`null`, this is treated the same way as would be done in
   *   {@link #appendAll}.
   */
  constructor(other = null) {
    super();

    // Note: We don't use the default constructor's ability to initialize from
    // an argument because it does the wrong thing with non-`Headers` objects
    // with array-valued names. (Specifically, it joins them with `,` and not
    // `, `; that is, it doesn't include a space.)

    if (other) {
      this.appendAll(other);
    }
  }

  /**
   * Like {@link #setAll} (see which), except appends to headers if they already
   * exist in the instance.
   *
   * @param {Headers|Map|object} other Source of entries to append. This is
   *   allowed to be anything that implements a map-like iterator, or a plain
   *   object.
   */
  appendAll(other) {
    const originallyHad = {};

    for (const [name, value] of HttpHeaders.#entriesForOther(other)) {
      if (typeof value === 'function') {
        if (originallyHad[name] === undefined) {
          // First time seeing this name.
          originallyHad[name] = this.has(name);
        }
        if (!originallyHad[name]) {
          this.append(name, value());
        }
      } else {
        this.append(name, value);
      }
    }
  }

  /**
   * Appends all of the given cookies as `Set-Cookie` headers.
   *
   * @param {Cookies} cookies Cookies to append.
   */
  appendSetCookie(cookies) {
    for (const cookie of cookies.responseHeaders()) {
      this.append('set-cookie', cookie);
    }
  }

  /**
   * Like the default `entries()` method, except alters names to be cased
   * appropriately for the indicated HTTP version. In addition, most values
   * returned are strings, but `Set-Cookie` values are always arrays of strings.
   *
   * This method is meant to make it easy to call `setHeader()` on an HTTP(ish)
   * response object.
   *
   * @param {string|number} httpVersion HTTP version string (e.g. `'1.1'` or
   *   `'2.0'`) or major version number (e.g. `2`).
   * @yields {Array} Entry with appropriately-cased name.
   */
  *entriesForVersion(httpVersion) {
    const classicNaming = (typeof httpVersion === 'string')
      ? (httpVersion[0] <= '1')
      : (httpVersion <= 1);

    let gotSetCookie = false;
    for (const [name, value] of this) {
      const finalName = classicNaming ? HttpUtil.classicHeaderNameFrom(name) : name;
      if (name === 'set-cookie') {
        // When iterating, a `Headers` object will emit multiple entries with
        // `set-cookie`. We use the first to trigger use of our special form and
        // then ignore subsequent ones.
        if (!gotSetCookie) {
          gotSetCookie = true;
          yield [finalName, this.getSetCookie()];
        }
      } else {
        yield [finalName, value];
      }
    }
  }

  /**
   * Extracts a subset of the headers. Names which aren't found are not listed
   * in the result, and don't cause an error. Extracted values are always
   * simple (pre-combined) strings, except for `Set-Cookies`, which is always
   * an array.
   *
   * @param {...string} names Names of headers to extract.
   * @returns {object} The extracted subset, as a mapping from the given `names`
   *   to their values.
   */
  extract(...names) {
    const result = {};

    for (const n of names) {
      const modName = HttpUtil.modernHeaderNameFrom(n);
      if (modName === 'set-cookie') {
        const cookies = this.getSetCookie();
        if (cookies.length !== 0) {
          result[n] = cookies;
        }
      } else {
        const got = this.get(modName);
        if (got !== null) {
          result[n] = got;
        }
      }
    }

    return result;
  }

  /**
   * Indicates whether this instance has all of the named headers.
   *
   * @param {...string} names Header names.
   * @returns {boolean} `true` if this instance has all of the headers, or
   *   `false` if not.
   */
  hasAll(...names) {
    for (const name of names) {
      if (!this.has(name)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Indicates whether this instance has any of the named headers.
   *
   * @param {...string} names Header names.
   * @returns {boolean} `true` if this instance has any of the headers, or
   *   `false` if not.
   */
  hasAny(...names) {
    for (const name of names) {
      if (this.has(name)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Sets headers on this instance for each of the entries in the given other
   * instance. This is _almost_ like iterating over the value and calling
   * `set()` on each, except that `Header` iterators can sometimes report the
   * same header name multiple times (because of `set-cookie`), and this method
   * takes care not to let that mess things up.
   *
   * Given a `Headers` object (including an instance of this subclass), all of
   * the entries are appended.
   *
   * Given a plain object or `Map` (or, really, more generally any object that
   * returns a map-like iterator), what is appended depends on the value:
   *
   * * Type `string`: The value is used directly.
   * * Other non-compound values: The value is converted to a string and then
   *   used.
   * * Functions: The entry is treated as an "underlay." If this instance does
   *   not have the header in question, the function is called to produce a
   *   value, and that value is then appended.
   * * Arrays: The contents of arrays are processed recursively, per these
   *   rules.
   * * Everything else is an error.
   *
   * **Note:** "Underlaying" (when given a function value) is based on the state
   * of the instance _before_ this method starts running.
   *
   * @param {Headers|Map|object} other Source of entries to append. This is
   *   allowed to be anything that implements a map-like iterator, or a plain
   *   object.
   */
  setAll(other) {
    const originallyHad = {};

    for (const [name, value] of HttpHeaders.#entriesForOther(other)) {
      const firstTime = (originallyHad[name] === undefined);
      if (firstTime) {
        // First time seeing this name.
        originallyHad[name] = this.has(name);
      }

      if (typeof value === 'function') {
        if (!originallyHad[name]) {
          this.append(name, value());
        }
      } else if (firstTime) {
        this.set(name, value);
      } else {
        this.append(name, value);
      }
    }
  }


  //
  // Static members
  //

  /**
   * Helper for {@link #appendAll} and {@link #setAll}, which iterates
   * (potentially recursively) over an `other` argument, as defined by those
   * methods.
   *
   * @param {*} other The instance to iterate over.
   * @yields {Array<string, *>} An entry, suitable for appending or setting.
   */
  static *#entriesForOther(other) {
    function* doOne(name, value) {
      if ((typeof value === 'string') || (typeof value === 'function')) {
        // The overwhelmingly most common cases.
        yield [name, value];
      } else if (typeof value === 'object') {
        if (Array.isArray(value)) {
          for (const v of value) {
            yield* doOne(name, v);
          }
        } else if (value === null) {
          yield [name, 'null'];
        } else {
          throw new Error(`Strange header value: ${value}`);
        }
      } else {
        yield [name, `${value}`];
      }
    }

    const iterateOver = other[Symbol.iterator]
      ? other                  // Use `other`'s defined iterator.
      : Object.entries(other); // Treat `other` as a plain object.

    for (const [name, value] of iterateOver) {
      yield* doOne(name, value);
    }
  }
}
