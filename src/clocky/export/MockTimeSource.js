// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise } from '@this/async';
import { Duration, Moment } from '@this/data-values';

import { IntfTimeSource } from '#x/IntfTimeSource';


/**
 * Mock implementation of `IntfTimeSource`, for help with testing.
 *
 * @implements {IntfTimeSource}
 */
export class MockTimeSource extends IntfTimeSource {
  /**
   * Current time.
   *
   * @type {Moment}
   */
  #now;

  /**
   * Array of pending timeouts.
   *
   * @type {Array<{ atSec: number, promise: Promise, resolve: function() }>}
   */
  #timeouts = [];

  /**
   * Has this instance been "ended?"
   *
   * @type {boolean}
   */
  #ended = false;

  /**
   * Result for {@link #_lastWaitFor}.
   *
   * @type {?Duration}
   */
  #lastWaitFor = null;

  /**
   * Constructs an instance.
   *
   * @param {number|Moment} firstNow Initial seconds-value for {@link #now}.
   */
  constructor(firstNow = 0) {
    super();

    this.#now = (firstNow instanceof Moment)
      ? firstNow
      : new Moment(firstNow);
  }

  /** @override */
  now() {
    if (this.#ended) {
      throw new Error(`MockTimeSource ended! (Time was ${this.#now.atSec}.)`);
    }

    return this.#now;
  }

  /** @override */
  async waitFor(dur, opts = undefined) {
    if (opts !== undefined) {
      throw new Error('Options not supported. Sorry!');
    }

    this.#lastWaitFor = dur;

    return this.waitUntil(this.#now.add(dur));
  }

  /** @override */
  async waitUntil(time) {
    if (this.#ended) {
      throw new Error(`MockTimeSource ended! (Time was ${this.#now.atSec}.)`);
    }

    if (time.atSec <= this.#now.atSec) {
      return;
    }

    const mp = new ManualPromise();
    this.#timeouts.push({
      atSec:   time.atSec,
      promise: mp.promise,
      resolve: () => mp.resolve()
    });

    await mp.promise;
  }

  /**
   * Mock control: "Ends" the instance. This resolves any pending `wait()`s and
   * prevents new ones from being added.
   */
  async _end() {
    for (const t of this.#timeouts) {
      t.resolve();
    }

    this.#ended = true;

    //await Promise.all(this.#timeouts.map((t) => t.promise));

    // Give the stuff waiting for the timeouts a moment to react before we
    // return.
    await setImmediate();
  }

  /**
   * Mock control: Returns the most recent duration value passed to `waitFor()`.
   *
   * @returns {Duration} The duration.
   */
  _lastWaitFor() {
    return this.#lastWaitFor;
  }

  /**
   * Mock control: Sets the current time. This can cause pending `wait()`s to
   * resolve.
   *
   * @param {number|Moment} newNow New seconds-value for {@link #now}.
   */
  _setTime(newNow) {
    if (!(newNow instanceof Moment)) {
      newNow = new Moment(newNow);
    }

    if (newNow.lt(this.#now)) {
      throw new Error('Cannot run time in reverse!');
    }

    this.#now = newNow;

    this.#timeouts.sort((a, b) => {
      if (a.atSec < b.atSec) return -1;
      if (a.atSec > b.atSec) return 1;
      return 0;
    });

    const nowSec = newNow.atSec;

    while (this.#timeouts[0]?.atSec <= nowSec) {
      this.#timeouts[0].resolve();
      this.#timeouts.shift();
    }
  }
}
