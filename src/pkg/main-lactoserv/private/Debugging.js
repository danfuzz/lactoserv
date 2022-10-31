// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as timers from 'node:timers/promises';

import { Loggy } from '@this/loggy';

import { MainArgs } from '#p/MainArgs';
import { UsualSystem } from '#p/UsualSystem';


/**
 * Utilities for debugging support.
 */
export class Debugging {
  /**
   * Processes the debugging-related arguments / options, if any.
   *
   * @param {MainArgs} args Command-line arguments.
   * @param {UsualSystem} system The system to be run.
   */
  static handleDebugArgs(args, system) {
    const { maxRunTimeSecs } = args;

    if (!maxRunTimeSecs) {
      return;
    }

    const logger = Loggy.loggerFor('main').debug;

    (async () => {
      logger.timerStarted({ seconds: maxRunTimeSecs });

      let remainingSecs = maxRunTimeSecs;
      if (maxRunTimeSecs > 60) {
        await timers.setTimeout((maxRunTimeSecs - 60) * 1000);
        remainingSecs = 60;
      }

      while (remainingSecs > 0) {
        const WARNING_FREQ_SECS = 10;
        logger.timeRemaining({ seconds: remainingSecs });
        await timers.setTimeout(WARNING_FREQ_SECS * 1000);
        remainingSecs -= WARNING_FREQ_SECS;
      }

      logger.timerExpired({ seconds: maxRunTimeSecs });
      await system.stop();
    })();
  }
}
