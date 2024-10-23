// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/decon';
import { Chalk } from '@this/texty';
import { MustBe } from '@this/typey';


/**
 * Always-on `Chalk` instance.
 *
 * @type {Chalk}
 */
const chalk = Chalk.ON;

/**
 * Structured "tag" information for log records. Each instance consists of a
 * main tag and zero or more additional "context" strings. The main tag is
 * typically a high-level system component of some sort, e.g. and typically a
 * module. The context strings, if any, are specific to the main tag (defined by
 * the component being so represented).
 */
export class LogTag extends IntfDeconstructable {
  /**
   * Main tag.
   *
   * @type {string}
   */
  #main;

  /**
   * Context strings.
   *
   * @type {Array<string>}
   */
  #context;

  /**
   * Precomputed value for {@link #allParts}, if available.
   *
   * @type {?Array<string>}
   */
  #allParts = null;

  /**
   * Precomputed "human form" strings, if available.
   *
   * @type {object}
   */
  #humanStrings = {};

  /**
   * Constructs an instance.
   *
   * @param {string} main Main tag. Must be a label-like string of no more than
   *   20 characters.
   * @param {...string} context Context strings. Each must have no more than 30
   *   characters.
   */
  constructor(main, ...context) {
    super();

    this.#main = LogTag.#checkMainString(main);

    for (const c of context) {
      LogTag.#checkContextString(c);
    }

    this.#context = Object.freeze(context);
  }

  /**
   * @returns {Array<string>} The combination of the main tag and context.
   * Always a frozen array.
   */
  get allParts() {
    if (!this.#allParts) {
      this.#allParts = Object.freeze([this.#main, ...this.#context]);
    }

    return this.#allParts;
  }

  /** @returns {Array<string>} Context strings. Always a frozen array. */
  get context() {
    return this.#context;
  }

  /**
   * @returns {?string} Last context string, or `null` if this instance has no
   * context. In the (common) case where this tag is attached to a logger which
   * was produced by accessing `$newId` on another logger, this is the ID that
   * was appended to the original logger's context.
   */
  get lastContext() {
    const length = this.#context.length;
    return (length === 0) ? null : this.#context[length - 1];
  }

  /** @returns {string} Main tag. */
  get main() {
    return this.#main;
  }

  /**
   * Compares this instance to another for equality, that is, whether the main
   * tag and context are all the same.
   *
   * @param {*} other Instance to compare to.
   * @returns {boolean} `true` iff `other` is an instance of this class with the
   *   same main tag and context.
   */
  equals(other) {
    if (this === other) {
      return true;
    }

    if (!(other instanceof LogTag)) {
      return false;
    }

    const thisCtx  = this.#context;
    const otherCtx = other.#context;

    if (!(   (this.#main === other.#main)
          && (thisCtx.length === otherCtx.length))) {
      return false;
    }

    for (let i = 0; i < thisCtx.length; i++) {
      if (thisCtx[i] !== otherCtx[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [styled] Should the result be styled/colorized?
   * @returns {string} The "human form" string.
   */
  toHuman(styled = false) {
    const objKey = styled ? 'styled' : 'unstyled';

    if (!this.#humanStrings[objKey]) {
      const parts = [
        styled ? LogTag.#COLOR_MAIN(this.#main) : this.#main
      ];

      const ctx = this.#context;
      for (let n = 0; n < ctx.length; n++) {
        const color = styled
          ? LogTag.#COLOR_CONTEXT[n]
          : null;

        parts.push('.', color ? color(ctx[n]) : ctx[n]);
      }

      this.#humanStrings[objKey] = parts.join('');
    }

    return this.#humanStrings[objKey];
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

  /** @override */
  deconstruct() {
    return new Sexp(LogTag, this.#main, ...this.#context);
  }


  //
  // Static members
  //

  /**
   * Color function for the main tag.
   *
   * @type {Function}
   */
  static #COLOR_MAIN = chalk.dim;

  /**
   * Color functions for context tags at the corresponding indexes.
   *
   * @type {Array<Function>}
   */
  static #COLOR_CONTEXT = [
    chalk.bold.dim,
    chalk.bold.ansi256(54),
    chalk.ansi256(54),
    chalk.blue
  ];

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
