// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { setImmediate } from 'node:timers/promises';

import { ManualPromise } from '@this/async';
import { Duration, Moment } from '@this/quant';

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
   * @type {Array<{ atSec: number, resolve: function() }>}
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
      resolve: () => mp.resolve()
    });

    await mp.promise;
  }

  /**
   * Mock control: Sets the time by advancing it by the given amount. This can
   * cause pending `wait()`s to resolve.
   *
   * @param {number|Duration} amount Amount of time to add to {@link #now} (in
   *   seconds if given a plain number).
   */
  _advanceTime(amount) {
    const newNow = (amount instanceof Duration)
      ? this.#now.add(amount)
      : this.#now.addSec(amount);

    this._setTime(newNow);
  }

  /**
   * Mock control: "Ends" the instance. This resolves any pending `wait()`s and
   * prevents new ones from being added. This also waits until the next
   * top-level event loop turn so that `await` reactions have a chance to do
   * whatever they need to do. The idea of all this is to make it so that this
   * method can be more or less the last thing done in a unit test body, with
   * the test able to know that doing so will make it safe to return without
   * risking complaints from the test harness around "stuff done after test
   * returned."
   */
  async _end() {
    // Make sure all the `resolve()`s happen in a different turn than the main
    // unit test body.
    await setImmediate();

    for (const t of this.#timeouts) {
      t.resolve();
    }

    this.#ended = true;

    // Give the stuff waiting for the timeouts a moment to react before we
    // return. (See above.)
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
