// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as util from 'node:util';

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

    this.#path = Object.isFrozen(path) ? path : Object.freeze([...path]);
    this.#wildcard = wildcard;
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
   * Gets a human-useful string form of this instance.
   *
   * @param {?{prefix: string, reverse: boolean, separator: string, suffix:
   *   string, wildcard: string}} [options = null] Formatting options. Only
   *   non-defaults need to be specified:
   *   * `prefix`, default `'/'` -- Prefix for the result.
   *   * `quote`, default `false` -- Quote components as strings?
   *   * `reverse`, default `false` -- Render in back-to-front order?
   *   * `separator`, default `'/'` -- Separator between path components.
   *   * `suffix`, default `''` -- Suffix for the result.
   *   * `wildcard`, default `'*'` -- Wildcard indicator.
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

    if (this.#wildcard) {
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

  /** @type {TreePathKey} A non-wildcard empty-path instance. */
  static get EMPTY() {
    return this.#EMPTY;
  }
}
