// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BuiltinApplications } from '@this/builtin-applications';
import { BuiltinServices } from '@this/builtin-services';
import { Host, KeepRunning } from '@this/host';


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
    BuiltinApplications.register();
    BuiltinServices.register();

    this.#initDone = true;
  }
}
