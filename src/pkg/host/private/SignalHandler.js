// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { CallbackList } from '#p/CallbackList';
import { ShutdownHandler } from '#p/ShutdownHandler';
import { ThisModule } from '#p/ThisModule';

import process from 'node:process'; // Need to import as such, for `.on*()`.


/**
 * @type {number} Maximum amount of time to wait for callbacks to complete,
 * while reloading the system.
 */
const MAX_RELOAD_MSEC = 10 * 1000;

/**
 * POSIX signal handling.
 */
export class SignalHandler {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {CallbackList} Callbacks to invoke when asked to "reload." */
  static #reloadCallbacks = new CallbackList('reload', MAX_RELOAD_MSEC);

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
   *
   * @param {function()} callback Reload-time callback.
   */
  static registerReloadCallback(callback) {
    this.#reloadCallbacks.register(callback);
  }

  /**
   * Handle a signal that should cause the process to exit.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleExitSignal(signalName) {
    ThisModule.log('signal', 'exit', signalName);

    ShutdownHandler.exit();
  }

  /**
   * Handle a signal that should cause the process to "reload."
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleReloadSignal(signalName) {
    if (ShutdownHandler.isShuttingDown()) {
      ThisModule.log('signal', 'ignoring', signalName);
      return;
    }

    ThisModule.log('signal', 'reload', signalName);

    // If this throws, it ends up becoming an unhandled promise rejection,
    // which will presumably cause the system to shut down.
    this.#reloadCallbacks.run();
  }
}
