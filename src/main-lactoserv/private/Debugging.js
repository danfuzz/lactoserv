// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
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
    const { earlyErrors, logToStdout, maxRunTimeSecs } = args;

    if (logToStdout) {
      this.#logToStdout();
    }

    if (maxRunTimeSecs) {
      this.#setMaxRunTimeSecs(maxRunTimeSecs, system);
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
      cause.name = 'Causeway';
      cause.code = 'CAUSAL';
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
   * @param {number} maxRunTimeSecs The maximum run time.
   * @param {UsualSystem} system The system to be run.
   */
  static #setMaxRunTimeSecs(maxRunTimeSecs, system) {
    const logger = this.#logger;

    (async () => {
      logger.timerStarted({ seconds: maxRunTimeSecs });

      let remainingSecs = maxRunTimeSecs;
      if (maxRunTimeSecs > 60) {
        await timers.setTimeout((maxRunTimeSecs - 60) * 1000);
        remainingSecs = 60;
      }

      let warningFreqSecs = 10;
      let extraSecs       = remainingSecs % warningFreqSecs;

      while (remainingSecs > 0) {
        logger.timeRemaining({ seconds: remainingSecs });

        const secs = extraSecs + warningFreqSecs;
        await timers.setTimeout(secs * 1000);
        remainingSecs -= secs;
        extraSecs = 0;

        if (remainingSecs <= 5) {
          warningFreqSecs = 1;
        } else if (remainingSecs <= 10) {
          warningFreqSecs = 5;
        }
      }

      logger.timerExpired({ seconds: maxRunTimeSecs });
      await system.stop();
    })();
  }
}
