// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';
import * as util from 'node:util';

/**
 * @type {number} How long to wait before considering a promise rejection
 * _actually_ rejected.
 */
const PROMISE_REJECTION_GRACE_PERIOD_MSEC = 1000;

/**
 * Top-level error handling. This is what handles errors (thrown exceptions and
 * rejected promises) that percolate to the main event loop without having been
 * handled. It also handles warnings (which always just get emitted directly,
 * no percolation required).
 */
export class TopErrorHandler {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {Map<Promise, *>} Map of unhandled rejections. */
  static #unhandledRejections = new Map();

  /**
   * Initializes the handlers.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    process.on('rejectionHandled',
      (...args) => this.#rejectionHandled(...args));
    process.on('unhandledRejection',
      (...args) => this.#unhandledRejection(...args));
    process.on('uncaughtException',
      (...args) => this.#uncaughtException(...args));
    process.on('warning',
      (...args) => this.#warning(...args));

    this.#initDone = true;
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
  static async #handleProblem(eventName_unused, label, problem) {
    const problemString = (problem instanceof Error)
      ? problem.stack
      : util.inspect(problem);

    // Write to `stderr` directly first, because logging might be broken.
    process.stderr.write(`${label}:\n${problemString}\n`);

    // TODO: Write to a real logger of some sort.

    // Give the system a moment, so it has a chance to actually flush the log,
    // and then exit.
    await timers.setTimeout(250); // 0.25 second.
    process.exit(1);
  }

  /**
   * Deals with an initially-rejected promise that was later handled.
   *
   * @param {Promise} promise The promise in question.
   */
  static #rejectionHandled(promise) {
    this.#unhandledRejections.delete(promise);
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
   * @param {Promise} promise The promise that was rejected.
   */
  static async #unhandledRejection(reason, promise) {
    this.#unhandledRejections.set(promise, reason);

    await timers.setTimeout(PROMISE_REJECTION_GRACE_PERIOD_MSEC);
    if (this.#unhandledRejections.has(promise)) {
      this.#handleProblem('unhandledRejection', 'Unhandled promise rejection', reason);
    }
  }

  /**
   * Deals with a warning.
   *
   * @param {Error} warning The warning.
   */
  static async #warning(warning) {
    const { code, message, name, stack } = warning;
    const summary = `${code ? `[${code}] ` : ''}${name}: ${message}`;

    // Trim stack down to at most just two `at` lines.
    let trimmedStack = null;
    if (stack) {
      const lines = [];
      for (const line of stack.split('\n')) {
        const result = /^( *at [^\n]+)\n?$/.exec(line);
        if (result) {
          lines.push(result[1]);
          if (lines.length === 2) {
            break;
          }
        }
      }
      if (lines.length !== 0) {
        trimmedStack = lines.join('\n');
      }
    }

    // TODO: Log this with a real logger.
    console.log('Warning: %s', summary);
    if (trimmedStack) {
      console.log('%s', trimmedStack);
    }
  }
}
