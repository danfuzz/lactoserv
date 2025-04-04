// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable, Sexp } from '@this/sexp';
import { Chalk, StyledText, TypeText } from '@this/texty';
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

    this.#main = LogTag.#mustBeMainString(main);

    for (const c of context) {
      LogTag.#mustBeContextString(c);
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
   * Gets a text representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [styled] Should the result be styled/colorized?
   * @returns {TypeText} The "human form" text.
   */
  toHuman(styled = false) {
    const objKey = styled ? 'styled' : 'unstyled';

    const maybeStyle = (text, style) => {
      return (styled && style)
        ? new StyledText(text, style)
        : text;
    };

    if (!this.#humanStrings[objKey]) {
      const parts = [maybeStyle(this.#main, LogTag.#STYLE_MAIN)];
      const ctx   = this.#context;

      for (let n = 0; n < ctx.length; n++) {
        parts.push('.', maybeStyle(ctx[n], LogTag.#STYLE_CONTEXT[n]));
      }

      this.#humanStrings[objKey] = styled
        ? StyledText.concat(...parts)
        : parts.join('');
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
  deconstruct(forLogging_unused) {
    return new Sexp(LogTag, this.#main, ...this.#context);
  }


  //
  // Static members
  //

  /**
   * Styling function for the main tag.
   *
   * @type {Function}
   */
  static #STYLE_MAIN = chalk.dim;

  /**
   * Styling functions for context tags at the corresponding indexes.
   *
   * @type {Array<Function>}
   */
  static #STYLE_CONTEXT = [
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
  static #mustBeContextString(value) {
    return MustBe.string(value, /^.{1,30}$/);
  }

  /**
   * Validates a main label string.
   *
   * @param {*} value Alleged main label string.
   * @returns {string} `value`, if it is valid.
   * @throws {Error} Thrown if `value` is invalid.
   */
  static #mustBeMainString(value) {
    return MustBe.string(value, /^(?![-.])(?:[-._a-zA-Z0-9]{1,20}|\(top\))(?<![-.])$/);
  }
}
