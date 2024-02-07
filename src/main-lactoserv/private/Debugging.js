// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { Host } from '@this/host';
import { IntfLogger } from '@this/loggy';

import { ThisModule } from '#p/ThisModule';
import { UsualSystem } from '#p/UsualSystem';


/**
 * Utilities for debugging support.
 */
export class Debugging {
  /**
   * @type {?IntfLogger} Logger for this class, or `null` not to do any
   * logging.
   */
  static #logger = ThisModule.logger.debug;

  /**
   * Processes the debugging-related arguments / options, if any.
   *
   * @param {object} args Parsed command-line debugging arguments.
   * @param {UsualSystem} system The system to be run.
   */
  static handleDebugArgs(args, system) {
    const { earlyErrors, logToStdout, maxRunTimeSec } = args;

    if (logToStdout) {
      this.#logToStdout();
    }

    if (maxRunTimeSec) {
      this.#setMaxRunTimeSec(maxRunTimeSec, system);
    }

    if (earlyErrors) {
      this.#doEarlyErrors();
    }
  }

  /**
   * Arrange for some early errors. (This is mostly to help test logging.)
   */
  static #doEarlyErrors() {
    (async () => {
      const problem = Promise.reject(new Error('I am a slow-but-handled promise rejection.'));

      // Wait enough ticks that Node's unhandled-rejection mechanism kicks in,
      // but few enough that it's slow-but-handled as far as `TopErrorHandler`
      // is concerned.
      for (let i = 1; i <= 5; i++) {
        await timers.setImmediate();
      }

      try {
        await problem;
      } catch {
        // Ignore.
      }

      // Wait a moment before continuing with the actually-uncaught examples.
      await timers.setTimeout(1000);

      // The timeout here is meant to jibe with `TopErrorHandler`'s grace period
      // given for unhandled promise rejections.
      setTimeout(() => {
        const error = new Error('I am an uncaught exception (from a callback).');
        error.beep = 'boop';
        throw error;
      }, 50);

      const cause = new TypeError('I am a cause.');
      cause.name = 'CausewayError';
      cause.code = 'CAUSAL-9000';
      throw new Error('I am an unhandled promise rejection.', { cause });
    })();
  }

  /**
   * Sets up logging to `stdout`.
   */
  static #logToStdout() {
    Host.logToStdout();
  }

  /**
   * Sets the maximum run time.
   *
   * @param {number} maxRunTimeSec The maximum run time.
   * @param {UsualSystem} system The system to be run.
   */
  static #setMaxRunTimeSec(maxRunTimeSec, system) {
    const logger = this.#logger;

    (async () => {
      logger.timerStarted({ seconds: maxRunTimeSec });

      let remainingSecs = maxRunTimeSec;
      if (maxRunTimeSec > 60) {
        await timers.setTimeout((maxRunTimeSec - 60) * 1000);
        remainingSecs = 60;
      }

      const WARNING_FREQ_SECS = 10;

      while (remainingSecs > 0) {
        logger.timeRemaining({ seconds: remainingSecs });

        let waitSecs = 1;
        if (remainingSecs >= (WARNING_FREQ_SECS * 2)) {
          waitSecs = WARNING_FREQ_SECS + (remainingSecs % WARNING_FREQ_SECS);
        } else if (remainingSecs >= WARNING_FREQ_SECS) {
          const HALF_FREQ_SECS = Math.trunc(WARNING_FREQ_SECS / 2);
          waitSecs = HALF_FREQ_SECS + (remainingSecs % HALF_FREQ_SECS);
        }

        await timers.setTimeout(waitSecs * 1000);
        remainingSecs -= waitSecs;
      }

      logger.timerExpired({ seconds: maxRunTimeSec });
      await system.stop();
    })();
  }
}
