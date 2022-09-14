// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { CallbackList } from '#p/CallbackList';

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

  /** @type {CallbackList} Callbacks to invoke when asked to "reload." */
  static #reloadCallbacks = new CallbackList('reload', MAX_RELOAD_MSEC);

  /** @type {CallbackList} Callbacks to invoke before shutting down. */
  static #shutdownCallbacks = new CallbackList('shutdown', MAX_SHUTDOWN_MSEC);

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
    this.init();
    this.#reloadCallbacks.register(callback);
  }

  /**
   * Registers a callback to be invoked when the system is about to shut down.
   * It is `await`ed (with a reasonable timeout) before the system actually
   * shuts down.
   *
   * @param {function()} callback Shutdown-time callback.
   */
  static registerShutdownCallback(callback) {
    this.init();
    this.#shutdownCallbacks.register(callback);
  }

  /**
   * Handle a signal that should cause the process to exit.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleExitSignal(signalName) {
    console.log();
    console.log(`Received signal: ${signalName}`);

    if (this.#shuttingDown) {
      this.#handleSignalWhileShuttingDown(signalName);
      return;
    }

    this.#shuttingDown = true;

    let exitCode = 0;

    try {
      await this.#shutdownCallbacks.run();
      console.log('Clean shutdown. Yay!');
    } catch (e) {
      console.log('Error during shutdown:\n%o', e.stack);
      exitCode = 1;
    }

    // Give the system a moment, so it has a chance to actually flush the log,
    // and then exit.
    await timers.setTimeout(250); // 0.25 second.
    process.exit(exitCode);
  }

  /**
   * Handle a signal that should cause the process to "reload."
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleReloadSignal(signalName) {
    console.log();
    console.log(`Received signal: ${signalName}`);

    if (this.#shuttingDown) {
      this.#handleSignalWhileShuttingDown(signalName);
      return;
    }

    // If this throws, it ends up becoming an unhandled promise rejection,
    // which will presumably cause the system to shut down.
    this.#reloadCallbacks.run();
  }

  /**
   * Handles a signal while in the middle of shutting down.
   *
   * @param {string} signalName Name of the signal.
   */
  static #handleSignalWhileShuttingDown(signalName) {
    console.log(`Ignoring signal: ${signalName}`);
    console.log(`Already shutting down!`);
  }
}
