// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';

import { Threadlet } from '@this/async';

import { CallbackList } from '#p/CallbackList';
import { ThisModule } from '#p/ThisModule';


/**
 * Top-level shutdown handling. This is what attempts to arrange for clean
 * shutdown of the system.
 */
export class ShutdownHandler {
  /**
   * @type {number} Maximum amount of time to wait for callbacks to complete,
   * while shutting down.
   */
  static #MAX_SHUTDOWN_MSEC = 10 * 1000;

  /**
   * @type {number} Amount of time to wait just before calling `process.exit()`,
   * intended to allow shutdown-time log messages to get flushed before the
   * process actually goes away.
   */
  static #PRE_EXIT_DELAY_MSEC = 250;

  /** @type {function(...*)} Logger for this class. */
  static #logger = ThisModule.logger.shutdown;

  /** @type {CallbackList} Callbacks to invoke before shutting down. */
  static #callbacks = new CallbackList('shutdown', this.#MAX_SHUTDOWN_MSEC);

  /** @type {boolean} Is the system shutting down? */
  static #shuttingDown = false;

  /** @type {number} Ultimate exit code. */
  static #exitCode = 0;

  /** @type {Threadlet} Thread that handles shutdown sequencing. */
  static #thread = new Threadlet(() => this.#run());

  /**
   * Attempts to shut down the system as cleanly as possible.
   *
   * @param {number} [exitCode = 0] Exit code to pass to `process.exit()`.
   */
  static async exit(exitCode = 0) {
    if (exitCode !== 0) {
      if (this.#exitCode === 0) {
        this.#exitCode = exitCode;
        this.#logger.exiting(exitCode);
      } else if (this.#exitCode !== exitCode) {
        this.#logger.ignoringExitCode(exitCode);
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
   */
  static registerCallback(callback) {
    this.#callbacks.register(callback);
  }

  /**
   * Main thread function: Run all the hooks, and then exit the process.
   */
  static async #run() {
    try {
      await this.#callbacks.run();
    } catch (e) {
      if (this.#exitCode === 0) {
        this.#exitCode = 1;
      }
    }

    this.#logger.bye(this.#exitCode);

    await timers.setTimeout(this.#PRE_EXIT_DELAY_MSEC);

    process.exit(this.#exitCode);
  }
}
