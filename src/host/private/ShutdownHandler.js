// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process'; // Need to import as such, for `.on*()`.

import { Threadlet } from '@this/async';
import { WallClock } from '@this/clocky';
import { IntfLogger } from '@this/loggy-intf';

import { CallbackList } from '#x/CallbackList';
import { ProductInfo } from '#x/ProductInfo';
import { ThisModule } from '#p/ThisModule';
import { TopErrorHandler } from '#p/TopErrorHandler';


/**
 * Top-level shutdown handling. This is what attempts to arrange for clean
 * shutdown of the system.
 */
export class ShutdownHandler {
  /**
   * Maximum amount of time to wait for callbacks to complete, while shutting
   * down.
   *
   * @type {number}
   */
  static #MAX_SHUTDOWN_MSEC = 10 * 1000;

  /**
   * Amount of time to wait just before calling `process.exit()`, intended to
   * allow shutdown-time log messages to get flushed before the process actually
   * goes away.
   *
   * @type {number}
   */
  static #PRE_EXIT_DELAY_MSEC = 250;

  /**
   * Logger for this class, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  static #logger = ThisModule.logger?.shutdown;

  /**
   * Callbacks to invoke before shutting down.
   *
   * @type {CallbackList}
   */
  static #callbacks = new CallbackList('shutdown', this.#MAX_SHUTDOWN_MSEC);

  /**
   * Is the system shutting down?
   *
   * @type {boolean}
   */
  static #shuttingDown = false;

  /**
   * Ultimate exit code.
   *
   * @type {number}
   */
  static #exitCode = 0;

  /**
   * Thread that handles shutdown sequencing.
   *
   * @type {Threadlet}
   */
  static #thread = new Threadlet(() => this.#run());

  /** @returns {?number} Exit code, if in fact in the middle of exiting. */
  static get exitCode() {
    return this.isShuttingDown() ? this.#exitCode : null;
  }

  /**
   * Attempts to shut down the system as cleanly as possible.
   *
   * @param {number} [exitCode] Exit code to pass to `process.exit()`.
   */
  static async exit(exitCode = 0) {
    if (exitCode !== 0) {
      if (this.#exitCode === 0) {
        this.#exitCode = exitCode;
        this.#logger?.exiting(exitCode);
      } else if (this.#exitCode !== exitCode) {
        this.#logger?.ignoringExitCode(exitCode);
      }
    }

    // This `await` is not ever supposed to return.
    await this.#thread.run();
    throw new Error('Shouldn\'t happen.');
  }

  /**
   * Is the system currently shutting down?
   *
   * @returns {boolean} The answer to the question.
   */
  static isShuttingDown() {
    return this.#thread.isRunning();
  }

  /**
   * Registers a callback to be invoked when the system is about to shut down.
   * It is `await`ed (with a reasonable timeout) before the system actually
   * shuts down.
   *
   * @param {function()} callback Shutdown-time callback.
   * @returns {CallbackList.Callback} Instance representing the registered
   *   callback, which can be used for un-registration.
   */
  static registerCallback(callback) {
    return this.#callbacks.register(callback);
  }

  /**
   * Main thread function: Run all the hooks, wait a moment, write any uncaught
   * errors to the console (just in case a human is watching), and then exit the
   * process.
   */
  static async #run() {
    try {
      await this.#callbacks.run();
    } catch (e) {
      // The `run()` call is never supposed to throw.
      console.log('Unexpected error in callback runner:\n', e);
      if (this.#exitCode === 0) {
        this.#exitCode = 1;
      }
    }

    this.#logger?.bye(this.#exitCode);

    await WallClock.waitForMsec(this.#PRE_EXIT_DELAY_MSEC);

    const problems = TopErrorHandler.problems;

    for (const { type, problem } of problems) {
      let label = ({
        uncaughtException:  'Uncaught exception',
        unhandledRejection: 'Unhandled rejection'
      })[type] ?? type;

      let p;
      for (p = problem; p instanceof Error; p = p.cause) {
        console.log('\n%s:\n%s', label, p.stack);
        label = 'caused by';
        for (const [key, value] of Object.entries(p)) {
          console.log('  %s: %o', key, value);
        }
      }
      if (p) {
        console.log('\n%s:\n%s', label, p.stack);
        console.log('%o', p);
      }
    }

    if (this.#exitCode !== 0) {
      console.log('\n%o', ProductInfo.allInfo);
      console.log('\nExiting with code: %o', this.#exitCode);
    }

    process.exit(this.#exitCode);
  }
}
