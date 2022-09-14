// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { CallbackList } from '#p/CallbackList';

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';


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
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {CallbackList} Callbacks to invoke before shutting down. */
  static #callbacks = new CallbackList('shutdown', MAX_SHUTDOWN_MSEC);

  /** @type {boolean} Is the system shutting down? */
  static #shuttingDown = false;

  /**
   * Attempts to shut down the system as cleanly as possible.
   *
   * @param {number} [exitCode = 0] Exit code to pass to `process.exit()`.
   */
  static async exit(exitCode) {
    if (this.#shuttingDown) {
      console.log('Ignoring redundant shutdown request.');
      return;
    }

    console.log('Shutting down...');

    try {
      await this.#callbacks.run();
      console.log('Clean shutdown. Yay!');
    } catch (e) {
      console.log('Error during shutdown:\n%o', e.stack);
      if (exitCode === 0) {
        exitCode = 1;
      }
    }

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
