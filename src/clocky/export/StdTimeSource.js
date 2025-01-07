// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfTimeSource } from '#x/IntfTimeSource';
import { WallClock } from '#x/WallClock';


/**
 * Standard implementation of {@link #IntfTimeSource}, which uses
 * {@link WallClock} as the underlying source of time.
 */
export class StdTimeSource extends IntfTimeSource {
  // @defaultConstructor

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async waitFor(dur, options = undefined) {
    return WallClock.waitFor(dur, options);
  }

  /** @override */
  async waitUntil(time) {
    return WallClock.waitUntil(time);
  }


  //
  // Static members
  //

  /**
   * Standard instance of this class.
   *
   * @type {StdTimeSource}
   */
  static #INSTANCE = new StdTimeSource();
  static {
    Object.freeze(this.#INSTANCE);
  }

  /** @returns {StdTimeSource} Standard instance of this class. */
  static get INSTANCE() {
    return this.#INSTANCE;
  }
}
