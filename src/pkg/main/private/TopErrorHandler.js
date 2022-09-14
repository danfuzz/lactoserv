// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';
import * as util from 'node:util';

/**
 * Top-level error handling. This is what handles errors (thrown exceptions and
 * rejected promises) that percolate to the main event loop without having been
 * handled.
 */
export class TopErrorHandler {
  /**
   * Initializes the handlers.
   */
  static init() {
    process.on('unhandledRejection',
      (...args) => this.#unhandledRejection(...args));
    process.on('uncaughtException',
      (...args) => this.#uncaughtException(...args));
  }

  /**
   * Handle either top-level problem, as indicated.
   *
   * @param {string} eventName_unused Event name to use for logging the problem.
   * @param {string} label How to label the problem in a human-oriented `error`
   *   log.
   * @param {*} problem The "problem" (uncaught exception or rejection reason).
   *   Typically, but not necessarily, an `Error`.
   */
  static #handleProblem(eventName_unused, label, problem) {
    const problemString = (problem instanceof Error)
      ? problem.stack
      : util.inspect(problem);

    // Write to `stderr` directly first, because logging might be broken.
    process.stderr.write(`${label}:\n${problemString}\n`);

    // TODO: Write to a real logger of some sort.

    // Give the system a moment, so it has a chance to actually flush the log,
    // and then exit.
    (async () => {
      await timers.setTimeout(250); // 0.25 second.
      process.exit(1);
    })();
  }

  /**
   * Deals with a thrown exception.
   *
   * @param {*} error Whatever happened to be thrown. Typically, but not
   *   necessarily, an `Error`.
   */
  static #uncaughtException(error) {
    this.#handleProblem('uncaughtException', 'Uncaught exception', error);
  }

  /**
   * Deals with a rejected promise.
   *
   * @param {*} reason The "reason" for rejection. Typically, but not
   *   necessarily, an `Error`.
   * @param {Promise} promise_unused The promise that was rejected.
   */
  static #unhandledRejection(reason, promise_unused) {
    // TODO: Queue up rejections for a brief amount of time (250msec?), while
    // checking to see if a related `rejectionHandled` gets emitted.
    this.#handleProblem('unhandledRejection', 'Unhandled promise rejection', reason);
  }
}
