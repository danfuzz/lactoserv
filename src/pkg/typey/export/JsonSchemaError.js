// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { JsonSchema } from '#x/JsonSchema';

/**
 * Error result from use of {@link JsonSchema}.
 */
export class JsonSchemaError {
  /** {string} Schema title. */
  #title;

  /** {object[]} Validation errors. */
  #errors;

  /**
   * Constructs an instance.
   *
   * @param {string} title Schema title.
   * @param {object[]} errors Errors as reported from a validation call.
   */
  constructor(title, errors) {
    this.#title = title;
    this.#errors = errors;
  }

  /**
   * Prints out this instance in a reasonably human-friendly form.
   *
   * @param {Function|{log: Function}} logger Function or `log`-function-bearing
   *   object to use for printing.
   */
  log(logger) {
    if (((typeof logger) === 'object') && logger.log) {
      const origLogger = logger;
      logger = (...args) => origLogger.log(...args);
    }

    logger('%s\n', `${this.#getMessage()}:`);

    for (const e of this.#errors) {
      console.log('%s:\n  %s\n  got: %o', e.instancePath, e.message, e.data);
    }

    logger('\n');
  }

  /**
   * Throws an error to represent this instance.
   *
   * @throws {Error} Reasonably descriptive error.
   */
  throwError() {
    throw new Error(`${this.#getMessage()}.`);
  }

  /**
   * Gets the top-line error message, sans punctuation.
   *
   * @returns {string} The message.
   */
  #getMessage() {
    const count = this.#errors.length;
    return `${count} error${count === 1 ? '' : 's'} in ${this.#title}`;
  }
}
