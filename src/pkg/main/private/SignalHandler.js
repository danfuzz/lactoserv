// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.
import * as timers from 'node:timers/promises';

/**
 * @type {number} Maximum amount of time to wait for callbacks to complete,
 * while reloading the system.
 */
const MAX_RELOAD_MSEC = 10 * 1000;

/**
 * @type {number} Maximum amount of time to wait for callbacks to complete,
 * while shutting down.
 */
const MAX_SHUTDOWN_MSEC = 10 * 1000;

/**
 * POSIX signal handling.
 */
export class SignalHandler {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {(function())[]} Callbacks to invoke when asked to "reload." */
  static #reloadCallbacks = [];

  /** @type {(function())[]} Callbacks to invoke before shutting down. */
  static #shutdownCallbacks = [];

  /** @type {boolean} Is the system currently reloading? */
  static #reloading = false;

  /** @type {boolean} Is the system shutting down? */
  static #shuttingDown = false;

  /**
   * Initializes the signal handlers.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    const exitFunc   = (...args) => this.#handleExitSignal(...args);
    const reloadFunc = (...args) => this.#handleReloadSignal(...args);
    process.on('SIGHUP',  reloadFunc);
    process.on('SIGINT',  exitFunc);
    process.on('SIGTERM', exitFunc);

    this.#initDone = true;
  }

  /**
   * Registers a callback to be invoked when the system is asked to "reload."
   * Reloading is not considered complete until the callback async-returns.
   *
   * @param {function()} callback Shutdown-time callback.
   */
  static registerReloadCallback(callback) {
    if (this.#shuttingDown) {
      console.log('Ignoring `registerReloadCallback()` during shutdown.');
    }

    this.#reloadCallbacks.push(callback);
  }

  /**
   * Registers a callback to be invoked when the system is about to shut down.
   * It is `await`ed (with a reasonable timeout) before the system actually
   * shuts down.
   *
   * @param {function()} callback Shutdown-time callback.
   */
  static registerShutdownCallback(callback) {
    if (this.#shuttingDown) {
      console.log('Ignoring `registerShutdownCallback()` during shutdown.');
    }

    this.#shutdownCallbacks.push(callback);
  }

  /**
   * Handle a signal that should cause the process to exit.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleExitSignal(signalName) {
    if (this.#shuttingDown) {
      this.#handleSignalWhileShuttingDown(signalName);
      return;
    }

    this.#shuttingDown = true;

    console.log();
    console.log(`Received signal \`${signalName}\`. Shutting down now...`);

    await this.#runCallbacks('reload', this.#shutdownCallbacks, MAX_SHUTDOWN_MSEC);

    console.log('Clean shutdown. Yay!');

    // Give the system a moment, so it has a chance to actually flush the log,
    // and then exit.
    await timers.setTimeout(250); // 0.25 second.
    process.exit(0);
  }

  /**
   * Handle a signal that should cause the process to "reload."
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleReloadSignal(signalName) {
    if (this.#shuttingDown) {
      this.#handleSignalWhileShuttingDown(signalName);
      return;
    } else if (this.#reloading) {
      console.log();
      console.log(`Received signal \`${signalName}\`. Already reloading!`);
      return;
    }

    console.log();
    console.log(`Received signal \`${signalName}\`. Reloading now...`);

    this.#reloading = true;

    await this.#runCallbacks('reload', this.#reloadCallbacks, MAX_RELOAD_MSEC);

    console.log('Done reloading. Yay!');
    this.#reloading = false;
  }

  /**
   * Handles a signal while in the middle of shutting down.
   *
   * @param {string} signalName Name of the signal.
   */
  static #handleSignalWhileShuttingDown(signalName) {
    console.log();
    console.log(`Received signal \`${signalName}\`. Already shutting down!`);
  }

  /**
   * Helper for the handlers: Runs a list of callbacks with a parallel timeout.
   *
   * @param {string} name Name of what's being handled (for logging and error
   *   messages).
   * @param {(function())[]} callbacks Callbacks to run.
   * @param {number} timeoutMsec How long to allow before timing out.
   */
  static async #runCallbacks(name, callbacks, timeoutMsec) {
    const callProm = Promise.allSettled(callbacks.map(async cb => cb()));
    const abortCtrl = new AbortController();

    (async () => {
      const timeout = timers.setTimeout(
        timeoutMsec, null, { signal: abortCtrl.signal });
      try {
        await timeout;
      } catch (e) {
        // If the timeout was aborted, just swallow it, and let the system
        // continue to run in peace. But for anything else, rethrow, which
        // should (soon) cause the system to exit due to the error.
        if (e?.code === 'ABORT_ERR') {
          return;
        } else {
          throw e;
        }
      }

      // Similar to above, throw an error to indicate timeout. The error should
      // (soon) cause the system to exit.
      throw new Error(`Timed out during ${name} signal handler!`);
    })();

    const callResults = await callProm;
    abortCtrl.abort();

    let rejectedCount = 0;
    for (const result of await callResults) {
      if (result.rejected) {
        rejectedCount++;
        console.log('Callback error in %s signal handler:\n%s',
          name, result.reason);
      }
    }

    if (rejectedCount !== 0) {
      // Similar to above, throw an error to indicate a problem with the
      // callbacks. The error should (soon) cause the system to exit.
      const plural = (rejectedCount === 1) ? '' : 's';
      throw new Error(`Problem with ${rejectedCount} ${name} callback${plural}.`);
    }
  }
}
