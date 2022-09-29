// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SeeAll, TextFileSink } from '@this/loggy';


/**
 * Stuff to deal with logging.
 */
export class LoggingManager {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /** @type {?TextFileSink} The logging event sink which writes to `stderr`. */
  static #stderrSink = null;

  /**
   * Initializes the logging system.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    // Start logging to `stderr`. TODO: Will need to let the main app direct
    // this elsewhere before we start to spew stuff out.
    const event = SeeAll.earliestEvent;
    this.#stderrSink = new TextFileSink('/dev/stderr', event);
    this.#stderrSink.run();

    this.#initDone = true;
  }
}
