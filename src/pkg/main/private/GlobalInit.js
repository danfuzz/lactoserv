// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { SignalHandler } from '#p/SignalHandler';
import { TopErrorHandler } from '#p/TopErrorHandler';

/**
 * Global process setup. This should be called early during system startup, so
 * that problems have the best chance of being caught by our own mechanisms and
 * not get the (often suboptimal) Node defaults.
 */
export class GlobalInit {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /**
   * Initializes the system.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    SignalHandler.init();
    TopErrorHandler.init();
    console.log('Global init complete.');

    this.#initDone = true;
  }
}
