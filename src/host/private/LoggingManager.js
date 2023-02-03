// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Loggy, TextFileSink } from '@this/loggy';


/**
 * Stuff to deal with logging.
 */
export class LoggingManager {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {?TextFileSink} The logging event sink which writes to `stdout`. */
  static #stdoutSink = null;

  /**
   * Initializes the logging system.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    // TODO: Is there anything to do here? If not, get rid of this method
    // entirely.

    this.#initDone = true;
  }

  /**
   * Starts logging to `stdout`.
   */
  static logToStdout() {
    if (this.#stdoutSink !== null) {
      // Already done!
      return;
    }

    const event = Loggy.earliestEvent;
    this.#stdoutSink = new TextFileSink('human', '/dev/stdout', event);
    this.#stdoutSink.run();
  }
}
