// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as timers from 'node:timers/promises';

import { Moment } from '@this/data-values';

import { IntfTimeSource } from '#x/IntfTimeSource';


/**
 * Standard implementation of {@link #IntfTimeSource}, which uses "wall time"
 * as provided by the JavaScript / Node implementation.
 */
export class StdTimeSource extends IntfTimeSource {
  // Note: The default constructor is fine.

  /** @override */
  now() {
    return new Moment(Date.now() * StdTimeSource.#SECS_PER_MSEC);
  }

  /** @override */
  nowSec() {
    return this.now().atSec;
  }

  /** @override */
  async waitUntil(time) {
    for (;;) {
      const delay = time.atSec - this.now().atSec;
      if ((delay <= 0) || !Number.isFinite(delay)) {
        break;
      }

      const delayMsec = delay * StdTimeSource.#MSEC_PER_SEC;
      await timers.setTimeout(delayMsec);
    }
  }


  //
  // Static members
  //

  /** @type {number} The number of milliseconds in a second. */
  static #MSEC_PER_SEC = 1000;

  /** @type {number} The number of seconds in a millisecond. */
  static #SECS_PER_MSEC = 1 / 1000;

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
