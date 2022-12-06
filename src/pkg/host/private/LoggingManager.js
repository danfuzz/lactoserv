// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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

    // Start logging to `stdout`. TODO: Will need to let the main system direct
    // this elsewhere before we start to spew stuff out.
    const event = Loggy.earliestEvent;
    this.#stdoutSink = new TextFileSink('/dev/stdout', event);
    this.#stdoutSink.run();

    this.#initDone = true;
  }
}
