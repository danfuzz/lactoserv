// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
    return WallClock.waitUntil(time);
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
