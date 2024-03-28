// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process'; // Need to import as such, for `.on*()`.
import { setImmediate } from 'node:timers/promises';
import * as util from 'node:util';

import { WallClock } from '@this/clocks';
import { IntfLogger } from '@this/loggy-intf';

import { ShutdownHandler } from '#p/ShutdownHandler';
import { ThisModule } from '#p/ThisModule';


/**
 * Top-level error handling. This is what handles errors (thrown exceptions and
 * rejected promises) that percolate to the main event loop without having been
 * handled. It also handles warnings (which always just get emitted directly, no
 * percolation required).
 */
export class TopErrorHandler {
  /**
   * How many ticks to wait after receiving an `unhandledRejection` event before
   * considering a promise rejection _actually_ unhandled.
   *
   * @type {number}
   */
  static #PROMISE_REJECTION_GRACE_PERIOD_TICKS = 10;

  /**
   * Logger for this class, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  static #logger = ThisModule.logger?.topError;

  /**
   * Initialized?
   *
   * @type {boolean}
   */
  static #initDone = false;

  /**
   * Map of unhandled rejections.
   *
   * @type {Map<Promise, *>}
   */
  static #unhandledRejections = new Map();

  /**
   * Currently trying to shut down?
   *
   * @type {boolean}
   */
  static #shuttingDown = false;

  /**
   * Actual object behind {@link #problems}.
   *
   * @type {Array<object>}
   */
  static #problems = [];

  /**
   * @returns {Array<{ type: string, problem: Error }>} List of all unhandled
   * problems that are precipitating shutdown. Typically no more than one
   * element, but if an error happens during error-related shutdown then there
   * can be more. Each element is an object which binds `type` and `problem`.
   */
  static get problems() {
    const problems = [];

    for (const p of this.#problems) {
      problems.push({ ...p });
    }

    return problems;
  }

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
   * @param {string} eventType Event type to use for logging the problem.
   * @param {string} label How to label the problem in a human-oriented `error`
   *   log.
   * @param {*} problem The "problem" (uncaught exception or rejection reason).
   *   Typically, but not necessarily, an `Error`.
   */
  static async #handleProblem(eventType, label, problem) {
    this.#problems.push({ type: eventType, problem });

    const problemString = util.inspect(problem);

    // Write to `stderr` directly first, because logging might be broken.
    process.stderr.write(`\n\n${label}:\n${problemString}\n\n`);

    this.#logger[eventType](problem);

    if (this.#shuttingDown) {
      // We're already in the middle of shutting down due to an error. Don't
      // redo the rest of this method; just hope for the best.
      return;
    }

    // First time making it to this point; indicate that yes really we are going
    // to shut down.
    this.#shuttingDown = true;

    // Give the system a moment, so it has a chance to actually flush the log,
    // then attempt first a clean then an abrupt exit.

    await WallClock.waitForMsec(250); // 0.25 second.

    try {
      // This shouldn't return...
      ShutdownHandler.exit(1);
    } catch {
      // ...but if it does, try harder to exit.
      process.exit(1);
    }
  }

  /**
   * Deals with an initially-rejected promise that was later handled.
   *
   * @param {Promise} promise The promise in question.
   */
  static async #rejectionHandled(promise) {
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

    for (let i = 1; i <= this.#PROMISE_REJECTION_GRACE_PERIOD_TICKS; i++) {
      await setImmediate();
      if (!this.#unhandledRejections.has(promise)) {
        this.#logger?.rejectionHandledSlowly(reason, { afterTicks: i });
        return;
      }
    }

    this.#handleProblem('unhandledRejection', 'Unhandled promise rejection', reason);
  }

  /**
   * Deals with a warning.
   *
   * @param {Error} warning The warning.
   */
  static async #warning(warning) {
    if (warning.name === 'ExperimentalWarning') {
      if (/VM Modules/.test(warning.message)) {
        // Suppress this one, because we totally know we're using it, and it's
        // intentional, so the warning is pure noise.
        return;
      }
    }

    this.#logger?.warning(warning);
  }
}
