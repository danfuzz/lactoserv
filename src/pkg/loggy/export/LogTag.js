// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

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

  /** @type {string[]} Context strings. */
  #context;

  /** @type {?string} Precomputed "human form" string, if available. */
  #humanString = null;

  /**
   * Constructs an instance.
   *
   * @param {string} main Main tag. Must be a label-like string of no more than
   *   20 characters.
   * @param {...string} context Context strings. Each must have no more than 30
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

  /**
   * @type {?string} Last context string, or `null` if this instance has no
   *   context. In the (common) case where this tag is attached to a logger
   *   which was produced by accessing `$newId` on another logger, this is the
   *   ID that was appended to the original logger's context.
   */
  get lastContext() {
    const length = this.#context.length;
    return (length === 0) ? null : this.#context[length - 1];
  }

  /** @type {string} Main tag. */
  get main() {
    return this.#main;
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [addSeparator = false] Should a separator character be
   *   appended at the end? If so, it is ` ` (space) for a top-level tag (no
   *   context) or `.` for a tag with context.
   * @returns {string} The "human form" string.
   */
  toHuman(addSeparator = false) {
    if (!this.#humanString) {
      const parts = [
        '<',
        this.#main,
        '>'
      ];

      let firstContext = true;
      for (const c of this.#context) {
        parts.push(firstContext ? ' ' : '.', c);
        firstContext = false;
      }

      if (addSeparator) {
        parts.push(this.#context.length === 0 ? ' ' : '.');
      }

      this.#humanString = parts.join('');
    }

    return this.#humanString;
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
    return MustBe.string(value, /^(?![-.])(?:[-._a-zA-Z0-9]{1,20}|\(top\))(?<![-.])$/);
  }
}
