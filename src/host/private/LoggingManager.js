// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import process from 'node:process';

import { Loggy, TextFileSink } from '@this/loggy';


/**
 * Stuff to deal with logging.
 */
export class LoggingManager {
  /** @type {?TextFileSink} The logging event sink which writes to `stdout`. */
  static #stdoutSink = null;

  /**
   * Starts logging to `stdout`.
   */
  static logToStdout() {
    if (this.#stdoutSink !== null) {
      // Already done!
      return;
    }

    const event     = Loggy.earliestEvent;
    const formatter = process.stdout.isTTY ? 'humanColor' : 'human';

    this.#stdoutSink = new TextFileSink(formatter, '/dev/stdout', event);
    this.#stdoutSink.run();
  }
}
