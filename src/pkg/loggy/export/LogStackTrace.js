// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';


/**
 * Stack trace for use within the logging system.
 */
export class LogStackTrace {
  /** @type {string} The stack trace. */
  #stack;

  /**
   * Constructs an instance.
   *
   * @param {string} stack The actual stack trace.
   */
  constructor(stack) {
    this.#stack = MustBe.string(stack);
  }

  /** @type {string} The actual stack trace. */
  get stack() {
    return this.#stack;
  }

  /**
   * Gets a replacement value for this instance, which is suitable for JSON
   * serialization.
   *
   * **Note:** This method is named as such (as opposed to the more
   * standard-for-this-project `toJSON`), because the standard method
   * `JSON.stringify()` looks for methods of this name to provide custom JSON
   * serialization.
   *
   * @returns {object} The JSON-serializable form.
   */
  toJSON() {
    return this.#stack;
  }
}
