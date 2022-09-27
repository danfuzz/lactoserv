// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LoggingManager } from '#p/LoggingManager';
import { ShutdownHandler } from '#p/ShutdownHandler';
import { SignalHandler } from '#p/SignalHandler';
import { ThisModule } from '#p/ThisModule';
import { TopErrorHandler } from '#p/TopErrorHandler';

/**
 * Global process setup and control for "host-oriented" (not in-browser)
 * systems.
 */
export class Host {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /**
   * Attempts to shut down the system as cleanly as possible, including running
   * all the registered shutdown-time callbacks.
   *
   * @param {number} [exitCode = 0] Exit code to pass to `process.exit()`.
   */
  static async exit(exitCode = 0) {
    this.init();
    await ShutdownHandler.exit(exitCode);
  }

  /**
   * Initializes the system. This should be called early during system startup,
   * so that problems have the best chance of being caught by our own mechanisms
   * and not get the (often suboptimal) Node defaults.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    LoggingManager.init();
    SignalHandler.init();
    TopErrorHandler.init();

    ThisModule.log('initialized');

    this.#initDone = true;
  }

  /**
   * Registers a callback to be invoked when the system is asked to "reload."
   * Reloading is not considered complete until the callback async-returns,
   * along with all the other registered ones. **Note:** The callbacks are
   * invoked concurrently with respect to each other and have a fixed overall
   * maximum time to run before the system considers the procedure to be hung.
   *
   * @param {function()} callback Reload-time callback.
   */
  static registerReloadCallback(callback) {
    this.init();
    SignalHandler.registerReloadCallback(callback);
  }

  /**
   * Registers a callback to be invoked when the system is about to shut down.
   * Final shutdown is not performed complete until the callback async-returns,
   * along with all the other registered ones. **Note:** The callbacks are
   * invoked concurrently with respect to each other and have a fixed overall
   * maximum time to run before the system considers the procedure to be hung.
   *
   * @param {function()} callback Shutdown-time callback.
   */
  static registerShutdownCallback(callback) {
    this.init();
    ShutdownHandler.registerCallback(callback);
  }
}
