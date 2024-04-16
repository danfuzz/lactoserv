// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { BaseConverter, Struct } from '@this/data-values';
import { MustBe } from '@this/typey';

import { TreePathMap } from '#x/TreePathMap';


/**
 * Key for use with {@link TreePathMap}. Instances are immutable, and contents
 * are strongly type-checked.
 */
export class TreePathKey {
  /**
   * Path portion of the key.
   *
   * @type {Array<string>}
   */
  #path;

  /**
   * Wildcard indicator.
   *
   * @type {boolean}
   */
  #wildcard;

  /**
   * The result of {@link #charLength}, or `null` if not yet calculated.
   *
   * @type {?number}
   */
  #charLength = null;

  /**
   * Constructs an instance from the given two components.
   *
   * **Note:** If not already frozen, the `path` is copied internally, in order
   * to maintain the immutability guarantee for instances.
   *
   * @param {Array<string>} path Path to the value.
   * @param {boolean} wildcard Wildcard indicator. This means different (though
   *   related) things, depending on the context in which an instance is used.
   */
  constructor(path, wildcard) {
    TreePathKey.checkArguments(path, wildcard);

    this.#path     = Object.isFrozen(path) ? path : Object.freeze([...path]);
    this.#wildcard = wildcard;
  }

  /**
   * @returns {number} The length of the path in total characters of all path
   * components combined. This does not include any count for (would-be) path
   * component separators or any wildcard indicators.
   */
  get charLength() {
    if (this.#charLength === null) {
      let result = 0;
      for (const p of this.#path) {
        result += p.length;
      }

      this.#charLength = result;
    }

    return this.#charLength;
  }

  /**
   * @returns {?string} The last element of {@link #path}, or `null` if this
   * instance is empty (that is, if `length === 0`).
   */
  get last() {
    const path   = this.#path;
    const length = path.length;

    return (length === 0) ? null : path[length - 1];
  }

  /**
   * @returns {number} The length of the path in components, that is, a
   * shorthand for `this.path.length`.
   */
  get length() {
    return this.#path.length;
  }

  /** @returns {Array<string>} The path. */
  get path() {
    return this.#path;
  }

  /** @returns {boolean} The wildcard indicator. */
  get wildcard() {
    return this.#wildcard;
  }

  /**
   * Standard `data-values` method to produce an encoded version of this
   * instance.
   *
   * @returns {Struct} The encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Struct(TreePathKey, null, this.#path, this.#wildcard);
  }

  /**
   * Concatenates any number of components, arrays of components, or other keys'
   * paths onto this one, returning a new instance with the same wildcard value
   * as this one. If all of the given arguments are empty, this method returns
   * `this`.
   *
   * @param {Array<string|Array<string>|TreePathKey>} others Values to
   *   concatenate to `this`.
   * @returns {TreePathKey} Instance with all of `others` concatenated.
   */
  concat(...others) {
    const path = [...this.#path];

    for (const o of others) {
      if (typeof o === 'string') {
        path.push(o);
      } else if (Array.isArray(o)) {
        path.push(...o);
      } else if (o instanceof TreePathKey) {
        path.push(...o.#path);
      } else {
        throw new Error('Invalid `other` argument.');
      }
    }

    return (path.length === this.#path.length)
      ? this
      : new TreePathKey(Object.freeze(path), this.#wildcard);
  }

  /**
   * Checks to see if this instance is equal to another of the same class. Path
   * components and wildcard flag must match for equality.
   *
   * @param {*} other Object to compare to.
   * @returns {boolean} `true` iff this instance is equal to `other`.
   */
  equals(other) {
    if (this === other) {
      return true;
    }

    if (!(other instanceof this.constructor)) {
      return false;
    }

    if (   (this.#wildcard    !== other.#wildcard)
        || (this.#path.length !== other.#path.length)) {
      return false;
    }

    for (let i = 0; i < this.#path.length; i++) {
      if (this.#path[i] !== other.#path[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Slices out a portion of this instance, returning an instance with the
   * resulting elements. The result is never marked as a wildcard. If `this` is
   * not a wildcard instance and `start..end` covers the entire instance, then
   * this method returns `this`.
   *
   * @param {number} start Start index, inclusive.
   * @param {number} [end] End index, exclusive. Defaults to {@link #length}.
   * @returns {TreePathKey} The sliced-out value.
   */
  slice(start, end = null) {
    const path   = this.#path;
    const length = path.length;

    end ??= length;

    MustBe.number(start, { safeInteger: true, minInclusive: 0,     maxInclusive: length });
    MustBe.number(end,   { safeInteger: true, minInclusive: start, maxInclusive: length });

    return ((start === 0) && (end === length) && !this.#wildcard)
      ? this
      : new TreePathKey(Object.freeze(path.slice(start, end)), false);
  }

  /**
   * Gets a human-useful string form of this instance.
   *
   * @param {?object} [options] Formatting options.
   * @param {string} [options.prefix] Prefix for the result. Default `'['`.
   * @param {boolean} [options.quote] Quote components as strings? Default
   *   `false`.
   * @param {boolean} [options.reverse] Render in back-to-front order? Default
   *   `false`.
   * @param {boolean} [options.separatePrefix] Use the separator between the
   *   prefix and first component? Default `false`.
   * @param {string} [options.separator] Separator between path components.
   *   Default `', '`.
   * @param {string} [options.suffix] Suffix for the result. Default `']'`.
   * @param {string|boolean} [options.wildcard] Wildcard indicator. If `false`,
   *   then a wildcard key is represented as if it were non-wildcard. (This is
   *   different than if this is `''` (the empty string)). Default `'*'`.
   * @returns {string} String form of the instance.
   */
  toString(options = null) {
    const defaultOptions = {
      prefix:         '[',
      quote:          false,
      reverse:        false,
      separatePrefix: false,
      separator:      ', ',
      suffix:         ']',
      wildcard:       '*'
    };

    options = options ? { ...defaultOptions, ...options } : defaultOptions;

    const path = options.quote
      ? this.#path.map((p) => util.format('%o', p))
      : [...this.#path];

    if (this.#wildcard && (options.wildcard !== null)) {
      path.push(options.wildcard);
    }

    if (options.reverse) {
      path.reverse();
    }

    const result = [options.prefix];
    for (const p of path) {
      if (options.separatePrefix || (result.length !== 1)) {
        result.push(options.separator);
      }
      result.push(p);
    }

    result.push(options.suffix);
    return result.join('');
  }

  /**
   * Gets an instance just like this one, except with `wildcard` as specified.
   * If this instance in fact already has the specified value for `wildcard`,
   * this method returns this instance.
   *
   * @param {boolean} wildcard Value for `wildcard`.
   * @returns {TreePathKey} An appropriately-constructed instance.
   */
  withWildcard(wildcard) {
    MustBe.boolean(wildcard);

    if (this.#wildcard === wildcard) {
      return this;
    }

    const result = new TreePathKey(this.#path, wildcard);

    // Avoid recalculating `charLength` if already known on the original.
    result.#charLength = this.#charLength;

    return result;
  }


  //
  // Static members
  //

  /**
   * A non-wildcard empty-path instance.
   *
   * @type {TreePathKey}
   */
  static #EMPTY = Object.freeze(new TreePathKey(Object.freeze([]), false));

  /** @returns {TreePathKey} A non-wildcard empty-path instance. */
  static get EMPTY() {
    return this.#EMPTY;
  }

  /**
   * Validates a "key-like" pair of `path` and `wildcard` arguments. This is
   * meant to be called in cases where a method could accept either a proper
   * instance of this class or a plain object that binds these as properties.
   *
   * @param {*} path The alleged key path.
   * @param {*} wildcard The alleged wildcard flag.
   * @throws {Error} Thrown iff the two arguments could not have been
   *   successfully used to construct a {@link TreePathKey}.
   */
  static checkArguments(path, wildcard) {
    MustBe.arrayOfString(path);
    MustBe.boolean(wildcard);
  }
}
