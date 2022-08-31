// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as util from 'node:util';

/**
 * Error result from use of {@link JsonSchema}.
 */
export class JsonSchemaError {
  /** @type {string} Schema title. */
  #title;

  /** @type {object[]} Validation errors. */
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
   *   object to use for printing. Note: This is expected to behave like
   *   `console.log()`, in terms of `%`-formatting and `\n`-appending.
   */
  log(logger) {
    if (((typeof logger) === 'object') && logger.log) {
      const origLogger = logger;
      logger = (...args) => origLogger.log(...args);
    }

    logger('%s', `${this.#getMessage()}:`);

    for (const e of this.#errors) {
      const origPath = e.instancePath.replace(/^[/]/, '').split('/');
      const path = [];

      for (const component of origPath) {
        if (component.match(/^[0-9]+$/)) {
          path.push(`[${component}]`);
        } else if (path.length === 0) {
          path.push(component === '' ? '<top>' : component);
        } else {
          path.push(`.${component}`);
        }
      }

      const got = JsonSchemaError.#errorStringFor(e.data, 9);
      console.log('  %s:\n    %s\n    got: %s', path.join(''), e.message, got);
    }

    logger();
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


  //
  // Static members
  //

  /**
   * Gets a possibly-trimmed string for the given data, for use in producing
   * error messages.
   *
   * @param {*} data Data to stringify.
   * @param {number} indent How much to indent all but the first line
   * @returns {string} Stringified version.
   */
  static #errorStringFor(data, indent) {
    const fullString = util.format('%o', data);
    const lines = fullString.split('\n');

    if (lines.length === 1) {
      return fullString;
    }

    if (lines.length > 3) {
      lines.splice(3, lines.length - 3, '...');
    }

    const spaces = ' '.repeat(indent);
    for (let i = 1; i < lines.length; i++) {
      lines[i] = `\n${spaces}${lines[i]}`;
    }

    return lines.join('');
  }
}
