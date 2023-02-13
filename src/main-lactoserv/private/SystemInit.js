// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Host } from '@this/host';


/**
 * System startup / init stuff.
 */
export class SystemInit {
  /** @type {boolean} Initialized? */
  static #initDone = false;

  /**
   * Performs initialization, if not already done.
   */
  static init() {
    if (this.#initDone) {
      return;
    }

    Host.init();

    this.#initDone = true;
  }
}
