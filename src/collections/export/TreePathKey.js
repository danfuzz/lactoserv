// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { BaseConverter, Construct } from '@this/data-values';
import { MustBe } from '@this/typey';


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
    MustBe.arrayOfString(path);
    MustBe.boolean(wildcard);

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
   * @returns {Construct} The encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Construct(TreePathKey, this.#path, this.#wildcard);
  }

  /**
   * Gets a human-useful string form of this instance.
   *
   * @param {?object} [options = null] Formatting options.
   * @param {string} [options.prefix = '/'] Prefix for the result.
   * @param {boolean} [options.quote = false] Quote components as strings?
   * @param {boolean} [options.reverse = false] Render in back-to-front order?
   * @param {string} [options.separator = '/'] Separator between path
   *   components.
   * @param {string} [options.suffix = ''] Suffix for the result.
   * @param {string|boolean} [options.wildcard = '*'] Wildcard indicator. If
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
   * Gets the string form of the given key, interpreted as a hostname, where the
   * TLD is the initial path component. That is, the result renders the path in
   * reverse.
   *
   * @param {TreePathKey} key The key to convert.
   * @returns {string} The string form.
   */
  static hostnameStringFrom(key) {
    return key.toString({
      prefix:    '',
      separator: '.',
      reverse:   true
    });
  }

  /**
   * Gets the string form of the given key, interpreted as an absolute URI path,
   * that is, the part of a URI after the hostname.
   *
   * @param {TreePathKey} key The key to convert.
   * @param {boolean} [showWildcard = true] Represent a wildcard key as such? If
   *   `false`, then the result is as if `key` were created with `wildcard ===
   *   false`.
   * @returns {string} The string form.
   */
  static uriPathStringFrom(key, showWildcard = true) {
    return key.toString({
      prefix:    '/',
      separator: '/',
      wildcard:  showWildcard ? '*' : null
    });
  }
}
