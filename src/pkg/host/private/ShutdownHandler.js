// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';

import { CallbackList } from '#p/CallbackList';
import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.shutdown;

/**
 * @type {number} Maximum amount of time to wait for callbacks to complete,
 * while shutting down.
 */
const MAX_SHUTDOWN_MSEC = 10 * 1000;

/**
 * Top-level shutdown handling. This is what attempts to arrange for clean
 * shutdown of the system.
 */
export class ShutdownHandler {
  /** @type {CallbackList} Callbacks to invoke before shutting down. */
  static #callbacks = new CallbackList('shutdown', MAX_SHUTDOWN_MSEC);

  /** @type {boolean} Is the system shutting down? */
  static #shuttingDown = false;

  /**
   * Attempts to shut down the system as cleanly as possible.
   *
   * @param {number} [exitCode = 0] Exit code to pass to `process.exit()`.
   */
  static async exit(exitCode = 0) {
    if (this.#shuttingDown) {
      logger.ignoring(exitCode);
      return;
    }

    logger.exiting(exitCode);
    this.#shuttingDown = true;

    try {
      await this.#callbacks.run();
    } catch (e) {
      if (exitCode === 0) {
        exitCode = 1;
      }
    }

    logger.bye(exitCode);

    // Give the system a moment, so it has a chance to flush the log.
    await timers.setTimeout(250); // 0.25 second.

    process.exit(exitCode);
  }

  /**
   * Is the system currently shutting down?
   *
   * @returns {boolean} The answer to the question.
   */
  static isShuttingDown() {
    return this.#shuttingDown;
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
}
