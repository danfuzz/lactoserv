// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfTimeSource, StdTimeSource } from '@this/clocks';
import { Duration, Frequency, Moment } from '@this/data-values';
import { MustBe } from '@this/typey';

import { ManualPromise } from '#x/ManualPromise';
import { Threadlet } from '#x/Threadlet';


/**
 * Implementation of a "rate limiter with burstiness service", which is based on
 * the "token bucket" / "leaky bucket" algorithms. This actually implements
 * _both_ the "leaky bucket as meter" and "leaky bucket as queue" mechanisms as
 * described by Wikipedia, thusly:
 *
 * When not experiencing contention, an instance acts as a "leaky bucket as
 * meter," granting as many tokens as are requested up to whatever burst
 * capacity is available, which itself ranges up to a configured maximum burst
 * size (the "bucket size" in the metaphor). And when there _is_ contention --
 * that is, when there is no burst capacity at all -- an instance acts as a
 * "leaky bucket as queue," where token grant requests are queued up and
 * processed at a steady token flow rate.
 *
 * This class does not define the token (bucket volume) unit. It is up to
 * clients to use whatever makes sense in their context.
 */
export class TokenBucket {
  /**
   * Maximum allowed instantaneous burst, in tokens. This is the "bucket
   * capacity" in the "leaky bucket as meter" metaphor.
   *
   * @type {number}
   */
  #maxBurstSize;

  /**
   * Token flow rate (a/k/a bucket fill rate).
   *
   * @type {Frequency}
   */
  #flowRate;

  /**
   * Maximum grant size for a waiter in the queue, in tokens.
   *
   * @type {number}
   */
  #maxQueueGrantSize;

  /**
   * The maximum allowed wait queue size, in tokens. That is, this is the sum of
   * all grants to be made from waiters in the queue. `Number.POSITIVE_INFINITY`
   * is used represent "no limit."
   *
   * @type {number}
   */
  #maxQueueSize;

  /**
   * Provide partial (non-integral / fractional) tokens?
   *
   * @type {boolean}
   */
  #partialTokens;

  /**
   * Time measurement implementation.
   *
   * @type {IntfTimeSource}
   */
  #timeSource;

  /**
   * Most recently measured time.
   *
   * @type {Moment}
   */
  #lastNow;

  /**
   * The number of tokens available for a burst, at time {@link #lastNow).
   *
   * @type {number}
   */
  #lastBurstSize;

  /**
   * Array of grant waiters.
   *
   * @type {Array<{ grant: number, startTime: Moment, doGrant: function(number)
   * }>}
   */
  #waiters = [];

  /**
   * The current waiter queue size, in tokens. This is the sum of
   * `.#waiters[*].grant` and represents how many tokens must be granted in
   * order to to clear out the waiters.
   *
   * @type {number}
   */
  #queueSize = 0;

  /**
   * Servicer thread for the {@link #waiters}.
   *
   * @type {Threadlet}
   */
  #waiterThread = new Threadlet((runnerAccess) => this.#serviceWaiters(runnerAccess));

  /**
   * Constructs an instance.
   *
   * @param {object} options Configuration options.
   * @param {Frequency} options.flowRate Token flow rate (a/k/a bucket fill
   *   rate), that is, how quickly the bucket gets filled with tokens. This
   *   defines the steady state "flow rate" allowed by the instance. Must be a
   *   positive (non-zero and non-negative) value. This is a required "option."
   * @param {number} [options.initialBurstSize] The instantaneously available
   *   burst size, in tokens, at the moment of construction. Defaults to
   *   `maxBurstSize` (that is, able to be maximally "bursted" from the get-go).
   * @param {number} options.maxBurstSize Maximum possible instantaneous burst
   *   size (that is, the total bucket capacity in the "leaky bucket as meter"
   *   metaphor), in tokens (arbitrary volume units). This defines the
   *   "burstiness" allowed by the instance. Must be a finite positive number.
   *   This is a required "option."
   * @param {number} [options.maxQueueGrantSize] Maximum grant size when
   *   granting requests from the waiter queue, in tokens. No queued grant
   *   requests will ever return a larger grant, even if there is available
   *   "burst volume" to accommodate it. Must be a finite non-negative number
   *   less than or equal to both `maxBurstSize` and `maxQueueSize`, or `null`
   *   to indicate the default. If `partialTokens === false`, then the value is
   *   rounded down to an integer by `Math.floor()`. If `0`, then this instance
   *   will only ever synchronously grant tokens. Defaults to the smaller of
   *   `maxBurstSize` or `maxQueueSize`.
   * @param {?number} [options.maxQueueSize] The maximum allowed waiter queue
   *   size, in tokens. Must be a finite non-negative number or `null`. If
   *   `null`, then there is no limit on the queue size. If `0`, then this
   *   instance will only ever synchronously grant tokens.
   * @param {boolean} [options.partialTokens] If `true`, allows the instance to
   *   provide partial tokens (e.g. give a client `1.25` tokens). If `false`,
   *   all token handoffs from the instance are quantized to integer values.
   * @param {IntfTimeSource} options.timeSource What to use to determine the
   *   passage of time. If not specified, the instance will use a standard
   *   implementation which measures time in seconds (_not_ msec) and bottoms
   *   out at the usual JavaScript / Node wall time interface (e.g.
   *   `Date.now()`, `timers.setTimeout()`).
   */
  constructor(options) {
    const {
      flowRate,
      initialBurstSize  = options.maxBurstSize,
      maxBurstSize,
      maxQueueGrantSize = null,
      maxQueueSize      = null,
      partialTokens     = false,
      timeSource        = TokenBucket.#DEFAULT_TIME_SOURCE
    } = options;

    this.#flowRate = MustBe.instanceOf(flowRate, Frequency);
    MustBe.number(flowRate.hertz, { minExclusive: 0 });

    this.#maxBurstSize  = MustBe.number(maxBurstSize, { finite: true, minExclusive: 0 });
    this.#partialTokens = MustBe.boolean(partialTokens);
    this.#timeSource    = MustBe.instanceOf(timeSource, IntfTimeSource);

    this.#maxQueueSize = (maxQueueSize === null)
      ? Number.POSITIVE_INFINITY
      : MustBe.number(maxQueueSize, { finite: true, minInclusive: 0 });

    const queueGrantLimit = Math.min(this.#maxBurstSize, this.#maxQueueSize);
    if (maxQueueGrantSize === null) {
      this.#maxQueueGrantSize = queueGrantLimit;
    } else {
      this.#maxQueueGrantSize = MustBe.number(maxQueueGrantSize,
        { minInclusive: 0, maxInclusive: queueGrantLimit });
    }

    if (!partialTokens) {
      this.#maxQueueGrantSize = Math.floor(this.#maxQueueGrantSize);
    }

    this.#lastBurstSize = MustBe.number(initialBurstSize, { minInclusive: 0, maxInclusive: maxBurstSize });
    this.#lastNow       = this.#timeSource.now();
  }

  /**
   * @returns {object} The configuration of this instance, in the form of an
   * object with properties, each of which corresponds to the corresponding
   * constructor option. This is mostly useful for testing and debugging.
   *
   * **Note:** If the default time source is used, then `timeSource` will be
   * `null` in the result.
   */
  get config() {
    const maxQueueSize = (this.#maxQueueSize === Number.POSITIVE_INFINITY)
      ? null
      : this.#maxQueueSize;

    const timeSource = (this.#timeSource === TokenBucket.#DEFAULT_TIME_SOURCE)
      ? null
      : this.#timeSource;

    return {
      flowRate:          this.#flowRate,
      maxBurstSize:      this.#maxBurstSize,
      maxQueueGrantSize: this.#maxQueueGrantSize,
      maxQueueSize,
      partialTokens:     this.#partialTokens,
      timeSource
    };
  }

  /**
   * Denies grant requests for all current waiters, clearing the waiters queue.
   * This is useful when trying to cleanly shut down the service which this
   * instance is associated with. This method async-returns once all denials
   * have been processed.
   */
  async denyAllRequests() {
    if (this.#waiters.length !== 0) {
      await this.#waiterThread.stop();
    }
  }

  /**
   * Gets a snapshot of this instance's state, as of its most recent update
   * (which corresponds to the last time any nontrivial token grant requests
   * were processed). The return value is an object with the following bindings:
   *
   * * `{number} availableBurstSize` -- The currently-available burst size, that
   *   is, the quantity of tokens currently in the bucket.
   * * `{number} availableQueueSize` -- The currently-available queue size, that
   *   is, the quantity of tokens that could potentially be reserved for new
   *   grant waiters. If this instance has no limit on the queue size, then this
   *   is `Number.POSITIVE_INFINITY`.
   * * `{Moment} now` -- The time as of the snapshot, according to this
   *   instance's time source.
   * * `{number} waiterCount` -- The number of queued (awaited) grant requests.
   *
   * @returns {object} Snapshot, as described above.
   */
  latestState() {
    return {
      availableBurstSize: this.#lastBurstSize,
      availableQueueSize: this.#maxQueueSize - this.#queueSize,
      now:                this.#lastNow,
      waiterCount:        this.#waiters.length
    };
  }

  /**
   * Requests a grant of a particular quantity (or quantity range) of tokens, to
   * be granted atomically (all at once). This method async-returns either when
   * the grant has been made _or_ promptly if the instance determines that it
   * cannot perform the grant due to its configured limits.
   *
   * The method accepts the quantity of tokens being requested, either as a
   * simple number or as an object with bindings to indicate a range:
   *
   * * `{number} minInclusive` -- Minimum quantity of tokens to be granted.
   *   Defaults to `0`. Invalid if negative or larger than this instance's
   *   `maxQueueGrantSize`. If this instance was constructed with `partialTokens
   *   === false`, then it is rounded up (`Math.ceil()`) when not a whole
   *   number.
   * * `{number} maxInclusive` -- Maximum quantity of tokens to be granted.
   *   Defaults to `0`. Invalid if negative, and clamped to `minInclusive` as a
   *   minimum. If this instance was constructed with `partialTokens === false`,
   *   then it is rounded down (`Math.floor()`) when not a whole number. This is
   *   allowed to be larger than `maxBurstSize`, but this method will never
   *   actually grant more than that.
   *
   * The actual granting of tokens proceeds as follows (in order):
   *
   * * If there is no contention (no queued waiters) and the available burst
   *   size can accommodate a grant of at least `minInclusive` tokens, then this
   *   method promptly succeeds with the maximum-possible requested grant.
   * * If `minInclusive` is `0`, then this method promptly succeeds with a grant
   *   of `0` tokens.
   * * If there is insufficient available waiter queue size to accommodate a
   *   grant of at least `minInclusive`, then this method promptly fails, with
   *   `done === false` and a grant of `0` tokens.
   * * The request is queued up as an awaited grant. When the request is finally
   *   dequeued, the grant will be for the smaller of `maxInclusive` or
   *   `maxQueueGrantSize` tokens (even if the available burst size happens to
   *   be larger at the moment of granting).
   *
   * This method returns an object with bindings as follows:
   *
   * * `{boolean} done` -- `true` if the grant was actually made. This can be be
   *   `true` even if `grant === 0`, in the case where the minimum requested
   *   grant is in fact `0`.
   * * `{number} grant` -- The quantity of tokens granted to the caller. This is
   *   `0` if `done === false`, and can also be a successful grant of `0`, if
   *   the minimum request was `0`.
   * * `{string} reason` -- The reason for the grant or lack thereof. This is
   *   one of:
   *   * `grant` -- Successful grant, including an in-range `grant === 0`.
   *   * `stopping` -- All grant requests are currently being denied, due to a
   *     call to {@link #denyAllRequests} which is currently in progress.
   *   * `full` -- This request would cause the waiter queue to be too large
   *     (including the case where `maxQueueSize === 0`).
   * * `{Duration} waitTime` -- The amount of time that was spent waiting for
   *   the grant.
   *
   * @param {number|object} quantity Requested quantity of tokens, as described
   *   above.
   * @returns {object} Result of grant request, as described above.
   * @throws {Error} Thrown if `quanity` is invalid.
   */
  async requestGrant(quantity) {
    const { minInclusive, maxInclusive } = this.#parseQuantity(quantity);

    // Handle all the synchronous-result possibilities.

    if (this.#waiters.length === 0) {
      // No waiters right now, so try to get the grant synchronously.
      this.#topUpBucket();
      const got = this.#grantNow(minInclusive, maxInclusive);
      if (got.done) {
        return this.#requestGrantResult(got.grant, 'grant', Duration.ZERO);
      }
    }

    if (minInclusive === 0) {
      return this.#requestGrantResult(0, 'grant', Duration.ZERO);
    }

    // The request could not be completed synchronously. Figure out if it should
    // be queued or should completely fail.

    // The actual would-be asynchronous grant, per method contract.
    const grant = Math.min(maxInclusive, this.#maxQueueGrantSize);

    if ((grant === 0) || (grant + this.#queueSize) > this.#maxQueueSize) {
      // Either the instance doesn't do queueing at all (`grant === 0`) or the
      // wait queue would overflow if this grant were queued up. So immediately
      // fail.
      return this.#requestGrantResult(0, 'full', Duration.ZERO);
    }

    // Queue up a new request, and make sure the waiter queue servicer thread is
    // running.

    const mp = new ManualPromise();

    this.#queueSize += grant;
    this.#waiters.push({
      grant,
      startTime:    this.#lastNow,
      doGrant:      (v) => mp.resolve(v)
    });

    this.#startWaiterThread();
    return await mp.promise;
  }

  /**
   * Instantaneously takes as many tokens as allowed, within the specified
   * range. This method accepts either an exact number of tokens to request or
   * an object as follows:
   *
   * * `{number} minInclusive` -- Minimum quantity of tokens to be granted. If
   *   the minimum can't be met, then the call will grant no (`0`) tokens.
   *   Defaults to `0`. Invalid if negative or larger than this instance's
   *   `maxQueueGrantSize`. If this instance was constructed with `partialTokens
   *   === false`, then it is rounded up (`Math.ceil()`) when not a whole
   *   number.
   * * `{number} maxInclusive` -- Maximum quantity of tokens to be granted.
   *   Defaults to `0`. Invalid if negative, and clamped to `minInclusive` as a
   *   minimum. If this instance was constructed with `partialTokens === false`,
   *   then it is rounded down (`Math.floor()`) when not a whole number. This is
   *   allowed to be larger than `maxBurstSize`, but this method will never
   *   actually grant more than that.
   *
   * This method returns an object with bindings as follows:
   *
   * * `{boolean} done` -- `true` if the grant is considered complete. This can
   *   be `true` even if `grant === 0`, in the case where the minimum requested
   *   grant is in fact `0`.
   * * `{number} grant` -- The quantity of tokens granted to the caller. This is
   *   `0` if the minimum requested grant cannot be made.
   * * `{Moment} waitUntil` -- The time to `waitUntil()` on this instance's time
   *   source until the request would be expected to be granted, if this were an
   *   asynchronously-requested grant, as if by {@link #requestGrant} (see
   *   which). If `done === true`, then this will be a time at or before the
   *   time source's `now()`.
   *
   * If the `minInclusive` request is non-zero, then this method will only ever
   * return `done === true` if there is no immediate contention for tokens
   * (e.g., due to async-active calls to {@link #requestGrant}). The resulting
   * `waitUntil` takes the wait queue -- that is, active contention -- into
   * account, though the actual required wait times can turn out to be larger
   * than what was returned due to _new_ contention.
   *
   * Note: This method _first_ tops up the token bucket based on the amount of
   * time elapsed since the previous top-up, and _then_ removes tokens. This
   * means (a) that it's never possible to take more tokens than the total
   * `maxBurstSize`, and (b) it is possible to totally empty the bucket with a
   * call to this method.
   *
   * @param {number|object} quantity Requested quantity of tokens, as described
   *   above.
   * @returns {object} Result object as described above.
   * @throws {Error} Thrown if the request is invalid (inverted range,
   *   `minInclusive` is more than the `maxQueueGrantSize`, etc.).
   */
  takeNow(quantity) {
    const { minInclusive, maxInclusive } = this.#parseQuantity(quantity);
    let result;

    if (this.#waiters.length === 0) {
      // There are no waiters, so we can try to satisfy the request.
      this.#topUpBucket();
      result = this.#grantNow(minInclusive, maxInclusive);
    } else {
      // There are waiters, so force either failure or success, with a grant of
      // `0` in either case.
      result = this.#grantNow(minInclusive, maxInclusive, true);
    }

    if (!result.done) {
      result.waitUntil =
        result.waitUntil.addSec(this.#queueSize / this.#flowRate.hertz);
    }

    return result;
  }

  /**
   * Helper for token-grant methods, which calculates an actual grant quantity.
   *
   * @param {number} minInclusive The minimum quantity of tokens to be granted.
   * @param {number} maxInclusive The maximum quantity of tokens to be granted.
   * @returns {number} The actual grant amount.
   */
  #calculateGrant(minInclusive, maxInclusive) {
    const availableGrantSize = this.#partialTokens
      ? this.#lastBurstSize
      : Math.floor(this.#lastBurstSize);

    maxInclusive = Math.min(maxInclusive, this.#maxBurstSize);

    if (availableGrantSize < minInclusive) {
      return 0;
    } else if (availableGrantSize < maxInclusive) {
      return availableGrantSize;
    } else {
      return maxInclusive;
    }
  }

  /**
   * Token grant helper, which implements the core functionality of {@link
   * #takeNow} and is used by other token-granting methods. Notably:
   *
   * * It assumes its arguments are valid, including (effectively) being
   *   processed by {@link #parseQuantity}.
   * * It does _not_ top up the bucket before taking action.
   * * It does not take into account any waiters, including the calculation of
   *   the returned wait time. (This is the method used to actually grant tokens
   *   on behalf of waiters!)
   *
   * This method returns an object with the following bindings, which all have
   * the same meaning as with {@link #takeNow}: `done`, `grant`, and
   * `waitUntil`.
   *
   * @param {number} minInclusive Minimum requested quantity of tokens.
   * @param {number} maxInclusive Maximum requested quantity of tokens.
   * @param {boolean} [forceZero] Force a `0` grant?
   * @returns {object} Grant result, as described above.
   */
  #grantNow(minInclusive, maxInclusive, forceZero = false) {
    const grant = forceZero
      ? 0
      : this.#calculateGrant(minInclusive, maxInclusive);
    const done = (grant !== 0) || (minInclusive === 0);

    if (done) {
      this.#lastBurstSize -= grant;
      return { done: true, grant, waitUntil: this.#lastNow };
    }

    // Per contract, we figure out a wait time as if the grant is from the
    // queue. So we duplicate `requestGrant()`'s calculation for what the grant
    // would be.
    const waitedGrantSize = Math.min(maxInclusive, this.#maxQueueGrantSize);
    const waitedSize      = waitedGrantSize - this.#lastBurstSize;
    const waitTimeSec     = waitedSize / this.#flowRate.hertz;
    const waitUntil       = this.#lastNow.addSec(waitTimeSec);

    return { done: false, grant: 0, waitUntil };
  }

  /**
   * Helper for `take*()` methods, which parses, adjusts, and and does validity
   * checking on a `quantity` argument.
   *
   * @param {object|number} quantity The requested quantity, as described by
   *   `take*()`.
   * @returns {function(number): number} Replacement arguments.
   * @throws {Error} Thrown if there is trouble with the arguments.
   */
  #parseQuantity(quantity) {
    let minInclusive;
    let maxInclusive;

    if (typeof quantity === 'number') {
      minInclusive = quantity;
      maxInclusive = quantity;
    } else {
      ({ maxInclusive = 0, minInclusive = 0 } = quantity);
    }

    if (!this.#partialTokens) {
      maxInclusive = Math.floor(maxInclusive);
      minInclusive = Math.ceil(minInclusive);
    }

    const maxQueueGrantSize = this.#maxQueueGrantSize;

    try {
      MustBe.number(minInclusive, { minInclusive: 0, maxInclusive: maxQueueGrantSize });
      MustBe.number(maxInclusive, { minInclusive: 0 });
    } catch (e) {
      throw new Error(`Impossible take request: ${minInclusive}..${maxInclusive}, max ${maxQueueGrantSize}`);
    }

    maxInclusive = Math.max(maxInclusive, minInclusive);

    return { minInclusive, maxInclusive };
  }

  /**
   * Produces a result for a call to {@link #requestGrant}.
   *
   * @param {number} grant Grant amount.
   * @param {string} reason Grant (or lack thereof) reason.
   * @param {Duration} waitTime Amount of time spent waiting, in seconds.
   * @returns {object} An appropriately-constructed result.
   */
  #requestGrantResult(grant, reason, waitTime) {
    const done = (reason === 'grant');
    return { done, grant, reason, waitTime };
  }

  /**
   * Starts the {@link #waiterThread} if it's not already running.
   */
  #startWaiterThread() {
    // This is a _little_ non-obvious: The following call returns a promise, and
    // we intentionally don't try to handle any rejection from it, exactly so
    // that problems show up as top-level unhandled promise rejections. Such
    // rejections are indicators of bugs, and so not something we would want
    // client code to be "naturally" exposed to.
    this.#waiterThread.run();
  }

  /**
   * Services {@link #waiters}. This gets run in {@link #waiterThread} whenever
   * {@link #waiters} is non-empty, and stops once it becomes empty.
   *
   * @param {Threadlet.RunnerAccess} runnerAccess Thread runner access object.
   */
  async #serviceWaiters(runnerAccess) {
    while (!runnerAccess.shouldStop()) {
      const info = this.#waiters[0];
      if (!info) {
        break;
      }

      this.#topUpBucket();
      const got = this.#grantNow(info.grant, info.grant);

      if (got.done) {
        this.#waiters.shift();
        this.#queueSize -= info.grant;
        const waitTime = this.#lastNow.subtract(info.startTime);
        info.doGrant(this.#requestGrantResult(got.grant, 'grant', waitTime));
      } else {
        await runnerAccess.raceWhenStopRequested([
          this.#waitUntil(got.waitUntil)
        ]);
      }
    }

    if (runnerAccess.shouldStop()) {
      // The thread was asked to stop, which only happens in this class when
      // `denyAllRequests()` was called. So, deny all requests.
      this.#topUpBucket(); // Makes `#lastTime` be current.
      for (const info of this.#waiters) {
        const waitTime = this.#lastNow.subtract(info.startTime);
        info.doGrant(this.#requestGrantResult(0, 'stopping', waitTime));
      }

      this.#waiters = [];
    }
  }

  /**
   * Tops up the bucket, based on how much time has elapsed since the last
   * topping-up.
   */
  #topUpBucket() {
    const now           = this.#timeSource.now();
    const lastBurstSize = this.#lastBurstSize;

    if (lastBurstSize < this.#maxBurstSize) {
      const elapsedTime   = now.subtract(this.#lastNow).sec;
      const grant         = elapsedTime * this.#flowRate.hertz;
      this.#lastBurstSize = Math.min(lastBurstSize + grant, this.#maxBurstSize);
    }

    this.#lastNow = now;
  }

  /**
   * Async-returns (hopefully very soon) after the time becomes the given value,
   * using this instance's time source.
   *
   * @param {Moment} time The time to wait until.
   */
  async #waitUntil(time) {
    if (time.isAfter(this.#lastNow)) {
      await this.#timeSource.waitUntil(time);
    }
  }


  //
  // Static members
  //

  /**
   * Default time source.
   *
   * @type {StdTimeSource}
   */
  static #DEFAULT_TIME_SOURCE = StdTimeSource.INSTANCE;
}
