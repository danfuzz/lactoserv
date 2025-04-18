// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process'; // Need to import as such, for `.on*()`.

import { IntfLogger } from '@this/loggy-intf';

import { CallbackList } from '#x/CallbackList';
import { HeapDump } from '#p/HeapDump';
import { ProductInfo } from '#x/ProductInfo';
import { ShutdownHandler } from '#p/ShutdownHandler';
import { ThisModule } from '#p/ThisModule';


/**
 * POSIX signal handling.
 */
export class SignalHandler {
  /**
   * Maximum amount of time to wait for callbacks to complete, while reloading
   * the system.
   *
   * @type {number}
   */
  static #MAX_RELOAD_MSEC = 10 * 1000;

  /**
   * Logger for this class, or `null` not to do any logging.
   *
   * @type {?IntfLogger}
   */
  static #logger = ThisModule.logger?.signal ?? null;

  /**
   * Initialized?
   *
   * @type {boolean}
   */
  static #initDone = false;

  /**
   * Callbacks to invoke when asked to "reload."
   *
   * @type {CallbackList}
   */
  static #reloadCallbacks = new CallbackList('reload', this.#MAX_RELOAD_MSEC);

  /**
   * Number of times the exit signal has been received. Used to force a
   * non-clean exit when the (human) user seems to be adamant about shutting
   * things down.
   *
   * @type {number}
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
   * @returns {CallbackList.Callback} Instance representing the registered
   *   callback, which can be used for un-registration.
   */
  static registerReloadCallback(callback) {
    return this.#reloadCallbacks.register(callback);
  }

  /**
   * Handles a signal that should cause the process to exit.
   *
   * @param {string} signalName Name of the signal.
   */
  static async #handleExitSignal(signalName) {
    const count = ++this.#exitSignalCount;

    this.#logger[signalName].exiting(count);

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
      this.#logger[signalName].ignoring();
      return;
    }

    this.#logger[signalName].reloading();

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
    this.#logger[signalName].dumping();
    await HeapDump.dump(ProductInfo.name);
    this.#logger[signalName].dumped();
  }
}
