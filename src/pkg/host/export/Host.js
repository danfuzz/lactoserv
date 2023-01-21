// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { DataConverter } from '@this/loggy';

import { LoggingManager } from '#p/LoggingManager';
import { ProcessInfo } from '#x/ProcessInfo';
import { ProductInfo } from '#x/ProductInfo';
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

    ThisModule.logger.exitCalled(exitCode);
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

    ProcessInfo.init();
    ProductInfo.init();
    LoggingManager.init();
    SignalHandler.init();
    TopErrorHandler.init();

    ThisModule.logger.initialized();

    this.#initDone = true;
  }

  /**
   * Is the system currently shutting down?
   *
   * @returns {boolean} The answer to the question.
   */
  static isShuttingDown() {
    return ShutdownHandler.isShuttingDown();
  }

  /**
   * Starts logging to `stdout`.
   */
  static logToStdout() {
    LoggingManager.logToStdout();
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

  /**
   * Gets a report on "shutdown disposition." This is `null` unless shutdown is
   * in progress, in which case it is an object which attempts to elucidate why
   * the system is shutting down.
   *
   * @returns {?object} The shutdown disposition, or `null` if the system isn't
   * actually shutting down.
   */
  static shutdownDisposition() {
    if (!this.isShuttingDown()) {
      return null;
    }

    const result = {
      shuttingDown: true,
      exitCode:     ShutdownHandler.exitCode
    };

    const problems = TopErrorHandler.problems;
    if (problems.length !== 0) {
      // Convert `Error` objects to a friendly JSON-encodable form.
      for (const p of problems) {
        p.problem = DataConverter.fix(p.problem);
        if (p.problem['@error']) {
          Object.assign(p, p.problem['@error']);
          if (!p.problem.problem) {
            delete p.problem;
          }
          p.errorClass = p['@name'];    delete p['@name'];
          p.message    = p['@message']; delete p['@message'];
          p.stack      = p['@stack'];   delete p['@stack'];
        }
      }

      result.problems = problems;
    }

    return result;
  }
}
