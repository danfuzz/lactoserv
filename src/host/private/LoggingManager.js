// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process';

import { WallClock } from '@this/clocky';
import { Duration } from '@this/quant';
import { Loggy, TextFileSink } from '@this/loggy';

import { ShutdownHandler } from '#p/ShutdownHandler';


/**
 * Stuff to deal with logging.
 */
export class LoggingManager {
  /**
   * The logging event sink which writes to `stdout`.
   *
   * @type {?TextFileSink}
   */
  static #stdoutSink = null;

  /**
   * Starts logging to `stdout`.
   */
  static logToStdout() {
    if (this.#stdoutSink !== null) {
      // Already done!
      return;
    }

    const bufferPeriod = Duration.parse('0.1 sec');
    const event        = Loggy.earliestEvent;
    const formatter    = process.stdout.isTTY ? 'humanColor' : 'human';

    this.#stdoutSink = new TextFileSink(formatter, '/dev/stdout', event, bufferPeriod);
    this.#stdoutSink.run();

    ShutdownHandler.registerCallback(async () => {
      // We want to try to log the stuff that's happening _during_ shutdown, so
      // we (a) wait a moment before completing the callback, so that we're more
      // likely to be one of the last to exit; and (b) only drain the log a
      // moment _after_ the callback completes.
      await WallClock.waitFor(bufferPeriod);
      (async () => {
        await WallClock.waitFor(bufferPeriod);
        await this.#stdoutSink.drainAndStop();
      })();
    });
  }
}
