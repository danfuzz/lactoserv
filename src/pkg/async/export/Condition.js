// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { MustBe } from '@this/typey';

/**
 * Boolean condition with promise-attached level triggers.
 */
export class Condition {
  /** {boolean} Current value. */
  #value;

  /**
   * {Promise<boolean>[]} Promises which get resolved when {@link #value} is
   * `false` (index `0`) or `true` (index `1`). Will be `null` for both indexes
   * when there are no waiters. Will only ever be non-null for one index at a
   * time. When non-null, the corresponding element of {@link #trigger} is the
   * resolver for the promise.
   */
  #became = [null, null];

  /**
   * {Function[]} Trigger functions corresponding to {@link #became}. Elements
   * are only non-null when there is a corresponding waiter.
   */
  #trigger = [null, null];

  /**
   * Constructs an instance.
   *
   * @param {boolean} [initialValue = false] Initial value.
   */
  constructor(initialValue = false) {
    MustBe.boolean(initialValue);

    this.#value = initialValue;
  }

  /** @returns {boolean} The current value. */
  get value() {
    return this._value;
  }

  /**
   * Sets the current value. Can cause waiters to stop waiting should the value
   * change.
   *
   * @param {boolean} value The new value.
   */
  set value(value) {
    MustBe.boolean(value);

    if (value === this.#value) {
      // No change.
      return;
    }

    const idx = value ? 1 : 0;
    this.#value = value;

    if (this.#trigger[idx]) {
      this.#trigger[idx](true);
      this.#trigger[idx] = null;
      this.#became[idx] = null;
    }
  }

  /**
   * Instantaneously switches the condition to `true` and then immediately
   * back to `false`. This will cause all promises to resolve, no matter which
   * state they were waiting for.
   */
  onOff() {
    this.value = true;
    this.value = false;
  }

  /**
   * Returns a promise which becomes resolved to `true` when the value of this
   * instance becomes `true`. If the value is already `true` then the return
   * value is an already-resolved promise.
   *
   * **Note:** Once resolved, the result will never become _un_-resolved should
   * the condition change state again. That is, you can't cache a return value
   * from this method and expect it to work for any later state changes.
   *
   * @returns {Promise<boolean>} Promise that resolves to `true` per the above
   *   description.
   */
  whenTrue() {
    return this.#whenX(true);
  }

  /**
   * Returns a promise which becomes resolved to `true` when the value of this
   * instance becomes `false`. If the value is already `true` then the return
   * value is an already-resolved promise.
   *
   * **Note:** Once resolved, the result will never become _un_-resolved should
   * the condition change state again. That is, you can't cache a return value
   * from this method and expect it to work for any later state changes.
   *
   * @returns {Promise<boolean>} Promise that resolves to `true` per the above
   *   description.
   */
  whenFalse() {
    return this.#whenX(false);
  }

  /**
   * Common implementation of {@link #whenTrue} and {@link #whenFalse}.
   *
   * @param {boolean} value Value which should prompt resolution.
   * @returns {Promise<boolean>} Promise that resolves to `true` on an
   *   appropriate value change.
   */
  async #whenX(value) {
    if (this.#value === value) {
      // Value is already as desired.
      return true;
    }

    const idx = value ? 1 : 0;
    if (!this.#became[idx]) {
      // There's not yet a promise. That is, there aren't yet any other waiters.
      // Make it, and hook up the corresponding trigger.
      this.#became[idx] = new Promise((resolve) => {
        this.#trigger[idx] = resolve;
      });
    }

    return this.#became[idx];
  }
}
