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
  /** @type {string[]} Path portion of the key. */
  #path;

  /** @type {boolean} Wildcard indicator. */
  #wildcard;

  /**
   * Constructs an instance from the given two components.
   *
   * **Note:** If not already frozen, the `path` is copied internally, in order
   * to maintain the immutability guarantee for instances.
   *
   * @param {string[]} path Path to the value.
   * @param {boolean} wildcard Wildcard indicator. This means different (though
   *   related) things, depending on the context in which an instance is used.
   */
  constructor(path, wildcard) {
    TreePathKey.checkArguments(path, wildcard);

    this.#path     = Object.isFrozen(path) ? path : Object.freeze([...path]);
    this.#wildcard = wildcard;
  }

  /**
   * @returns {number} The length of the path, that is, a shorthand for
   * `this.path.length`.
   */
  get length() {
    return this.#path.length;
  }

  /** @returns {string[]} The path. */
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
   * Gets the string form of this instance, interpreted as a hostname, where the
   * TLD is the initial path component. That is, the result renders the path in
   * reverse.
   *
   * @returns {string} The string form.
   */
  toHostnameString() {
    return this.toString({
      prefix:    '',
      separator: '.',
      reverse:   true
    });
  }

  /**
   * Gets the string form of this instance, interpreted as an absolute URI path,
   * that is, the part of a URI after the hostname. The result always includes
   * an initial slash (`/`) and never includes a final slash (or more accurately
   * a final slash indicates an empty path component at the end).
   *
   * @param {boolean} [showWildcard] Represent a wildcard key as a final `/*`?
   *   If `false`, then the result is as if `key` were created with `wildcard
   *   === false`.
   * @returns {string} The string form.
   */
  toUriPathString(showWildcard = true) {
    return this.toString({
      prefix:    '/',
      separator: '/',
      wildcard:  showWildcard ? '*' : null
    });
  }

  /**
   * Gets a human-useful string form of this instance.
   *
   * @param {?object} [options] Formatting options.
   * @param {string} [options.prefix] Prefix for the result.
   * @param {boolean} [options.quote] Quote components as strings?
   * @param {boolean} [options.reverse] Render in back-to-front order?
   * @param {string} [options.separator] Separator between path
   *   components.
   * @param {string} [options.suffix] Suffix for the result.
   * @param {string|boolean} [options.wildcard] Wildcard indicator. If
   *   `false`, then a wildcard key is represented as if it were non-wildcard.
   *   (This is different than if this is `''` (the empty string)).
   * @returns {string} String form of the instance.
   */
  toString(options = null) {
    const defaultOptions = {
      prefix:    '/',
      quote:     false,
      reverse:   false,
      separator: '/',
      suffix:    '',
      wildcard:  '*'
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
      if (result.length !== 1) {
        result.push(options.separator);
      }
      result.push(p);
    }

    result.push(options.suffix);
    return result.join('');
  }


  //
  // Static members
  //

  /** @type {TreePathKey} A non-wildcard empty-path instance. */
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

  /**
   * The same as {@link #toHostnameString}, except as a `static` method, for
   * convenient use as a stringifier function, e.g. in `TreePathMap`.
   *
   * @param {TreePathKey} key The key to convert.
   * @returns {string} The string form.
   */
  static hostnameStringFrom(key) {
    return key.toHostnameString();
  }

  /**
   * The same as {@link #toUriPathString}, except as a `static` method, for
   * convenient use as a stringifier function, e.g. in `TreePathMap`.
   *
   * @param {TreePathKey} key The key to convert.
   * @param {boolean} [showWildcard] Represent a wildcard key as such?
   * @returns {string} The string form.
   */
  static uriPathStringFrom(key, showWildcard = true) {
    return key.toUriPathString(showWildcard);
  }
}
