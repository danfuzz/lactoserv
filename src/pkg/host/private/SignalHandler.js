// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import process from 'node:process'; // Need to import as such, for `.on*()`.

import { CallbackList } from '#p/CallbackList';
import { HeapDump } from '#p/HeapDump';
import { ProductInfo } from '#x/ProductInfo';
import { ShutdownHandler } from '#p/ShutdownHandler';
import { ThisModule } from '#p/ThisModule';


/** @type {function(...*)} Logger for this class. */
const logger = ThisModule.logger.signal;

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
   * @type {number} Number of times the exit signal has been received. Used to
   * force a non-clean exit when the (human) user seems to be adamant about
   * shutting things down.
   */
  static #exitSignalCount = 0;

  /**
   * Initializes the signal handlers.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    const dumpFunc   = (...args) => this.#handleDumpSignal(...args);
    const exitFunc   = (...args) => this.#handleExitSignal(...args);
    const reloadFunc = (...args) => this.#handleReloadSignal(...args);
    process.on('SIGHUP',  reloadFunc);
    process.on('SIGINT',  exitFunc);
    process.on('SIGTERM', exitFunc);
    process.on('SIGUSR2', dumpFunc);

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
   * Handles a signal that should cause the process to exit.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleExitSignal(signalName) {
    const count = ++this.#exitSignalCount;

    logger[signalName].exiting(count);

    if (count === 1) {
      ShutdownHandler.exit();
    } else if (count > 3) {
      process.stderr.write('\n\nNot waiting for clean shutdown. Bye!\n');
      process.exit(1);
    }
  }

  /**
   * Handles a signal that should cause the process to "reload."
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleReloadSignal(signalName) {
    if (ShutdownHandler.isShuttingDown()) {
      logger[signalName].ignoring();
      return;
    }

    logger[signalName].reloading();

    // If this throws, it ends up becoming an unhandled promise rejection,
    // which will presumably cause the system to shut down.
    this.#reloadCallbacks.run();
  }

  /**
   * Handles a signal that should cause a heap dump to be produced.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleDumpSignal(signalName) {
    logger[signalName].dumping();
    await HeapDump.dump(ProductInfo.name);
    logger[signalName].dumped();
  }
}
