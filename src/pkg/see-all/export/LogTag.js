// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

/**
 * Structured "tag" information for log records. Each instance consists of a
 * main tag and zero or more additional "context" strings. The main tag is
 * typically a high-level system component of some sort, e.g. and typically a
 * module. The context strings, if any, are specific to the main tag (defined
 * by the component being so represented).
 */
export class LogTag {
  /** @type {string} Main tag. */
  #main;

  /** @type {string[]} Context strings */
  #context;

  /**
   * Constructs an instance.
   *
   * @param {string} main Main tag. Must be a label-like string of no more than
   *   20 characters.
   * @param {string[]} context Context strings. Each must have no more than 30
   *   characters.
   */
  constructor(main, ...context) {
    this.#main = LogTag.#checkMainString(main);

    for (const c of context) {
      LogTag.#checkContextString(c);
    }

    this.#context = Object.freeze(context);
  }

  /** @type {string[]} Context strings. Always a frozen array. */
  get context() {
    return this.#context;
  }

  /** @type {string} Main tag. */
  get main() {
    return this.#main;
  }

  /**
   * Constructs an instance just like this one, except with additional context
   * strings.
   *
   * @param {...string} context Additional context strings.
   * @returns {LogTag} An appropriately-constructed instance.
   */
  withAddedContext(...context) {
    return new LogTag(this.#main, ...this.#context, ...context);
  }


  //
  // Static members
  //

  /**
   * Validates a context string.
   *
   * @param {*} value Alleged context string.
   * @returns {string} `value`, if it is valid.
   * @throws {Error} Thrown if `value` is invalid.
   */
  static #checkContextString(value) {
    return MustBe.string(value, /^.{1,30}$/);
  }

  /**
   * Validates a main label string.
   *
   * @param {*} value Alleged main label string.
   * @returns {string} `value`, if it is valid.
   * @throws {Error} Thrown if `value` is invalid.
   */
  static #checkMainString(value) {
    return MustBe.string(value, /^(?![-.])[-._a-zA-Z0-9]{1,20}(?<![-.])$/);
  }
}
