// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { Moment } from '@this/data-values';

import { IntfTimeSource } from '#x/IntfTimeSource';
import { WallClock } from '#x/WallClock';


/**
 * Standard implementation of {@link #IntfTimeSource}, which uses
 * {@link WallClock} as the underlying source of time.
 */
export class StdTimeSource extends IntfTimeSource {
  // Note: The default constructor is fine.

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async waitUntil(time) {
    for (;;) {
      const delay = time.atSec - this.now().atSec;
      if ((delay <= 0) || !Number.isFinite(delay)) {
        break;
      }

      const delayMsec = delay * 1000;
      await timers.setTimeout(delayMsec);
    }
  }


  //
  // Static members
  //

  /** @type {StdTimeSource} Standard instance of this class. */
  static #INSTANCE = new StdTimeSource();
  static {
    Object.freeze(this.#INSTANCE);
  }

  /** @returns {StdTimeSource} Standard instance of this class. */
  static get INSTANCE() {
    return this.#INSTANCE;
  }
}
