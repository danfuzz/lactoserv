// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { ManualPromise } from '#x/ManualPromise';


/**
 * Promise-based mutex implementation. This provides _non-reentrant_ mutual
 * exclusion. This class can be used to serialize running of critical sections
 * of code, among other things.
 */
export class Mutex {
  /**
   * @type {?symbol} Unique symbol representing the current lock holder, or
   * `null` if the lock is not currently held. This symbol serves as the "key"
   * for unlocking, such that only the current lock holder can unlock the
   * instance.
   */
  #lockedBy = null;

  /**
   * @type {(function())[]} Array of "release" functions, each of which
   * represents a waiters for lock acquisition, in FIFO order.
   */
  #waiters = [];

  // Note: The default constructor is fine for this class.

  /**
   * Acquires the mutual exclusion lock. This method returns only after the lock
   * has been released by all previous lock requesters. The return value is a
   * function which, when called, releases the lock and so allows other threads
   * of control to get the lock. Typical use should look like this:
   *
   * ```
   * const unlock = await mutex.lock();
   * try {
   *   ... do something interesting ...
   * } finally {
   *   unlock();
   * }
   * ```
   *
   * **Note:** It is preferable to use {@link #serialize} instead of this
   * method, if your use case allows for it, because that method automatically
   * handles the unlocking of the mutex as control passes back out of the
   * protected code.
   *
   * @returns {function()} Function of no arguments which releases the lock when
   *   called.
   */
  async lock() {
    const key = Symbol('mutex_key'); // Uninterned symbol and so unique.

    if (this.#lockedBy !== null) {
      // There's contention, so we have to queue up. The function queued up on
      // `waiters` gets called inside the returned unlock function below.
      const prom = new ManualPromise();
      this.#waiters.push(() => prom.resolve(true));
      await prom.promise;
    }

    this.#lockedBy = key;

    // The return value is the unlock function.
    return () => {
      if (this.#lockedBy !== key) {
        throw new Error('Attempt to unlock by non-owner.');
      }

      if (this.#waiters.length === 0) {
        this.#lockedBy = null;
      } else {
        // Release the next queued up waiter.
        const release = this.#waiters.shift();
        release();
      }
    };
  }

  /**
   * Serializes execution of functions. Specifically: Acquires this instance's
   * lock, calls the given function with the lock held, and then releases the
   * lock. The return value of this method is whatever is returned by the given
   * function; or if the function throws an error, then likewise this method
   * throws that same error.
   *
   * @param {function()} func The function to call once the mutex is acquired.
   *   It is allowed to be an `async` function.
   * @returns {*} Whatever `func()` returns, if anything.
   * @throws {*} Whatever `func()` throws, if anything.
   */
  async serialize(func) {
    MustBe.function(func);
    const unlock = await this.lock();

    try {
      return await func();
    } finally {
      unlock();
    }
  }
}
