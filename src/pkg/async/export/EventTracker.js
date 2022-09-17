// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';

/**
 * Event tracker, which makes it convenient to walk down a chain of {@link
 * ChainedEvent} instances. This class strictly _consumes_ events; it does not
 * produce them. This class functions approximately as an iterator over an event
 * chain, but implements much more than the basic iterator functionality.
 *
 * **Note:** Instances of this class can be responsible for garbage accumulation
 * of event instances in the case where (a) an instance of this class is not
 * itself garbage, (b) nothing is "servicing" it, so it never advances through
 * the chain, and (c) there is a source which continues emitting events on the
 * chain.
 */
export class EventTracker {
  /**
   * @type {?Promise<ChainedEvent>} Promise for the first event on the chain,
   * when appropriate.
   */
  #firstPromise;

  /** @type {?ChainedEvent} First event on the chain, if known. */
  #firstNow;

  /**
   * @type {number} How many events need to be skipped over from the tracked
   * chain before {@link #firstNow} can be set. `-1` means that {@link
   * #firstNow} is valid.
   */
  #skipCount = 0;

  /**
   * Constructs an instance.
   *
   * @param {ChainedEvent|Promise<ChainedEvent>} firstEvent First event on the
   *   tracked chain, or promise to same.
   */
  constructor(firstEvent) {
    if (firstEvent instanceof Promise) {
      this.#firstPromise = this.#handleSkips(firstEvent);
      this.#firstNow     = null;
      this.#skipCount    = 0;
    } else if (firstEvent instanceof ChainedEvent) {
      this.#firstPromise = null;
      this.#firstNow     = firstEvent;
      this.#skipCount    = -1;
    } else {
      throw new Error('Invalid value for `firstEvent`.');
    }
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the first (earliest-known)
   * event tracked by this instance. This is an immediately-resolved promise in
   * all cases _except_ when either (a) this instance has yet to observe an
   * event, or (b) it is {@link #advance}d past the end of the chain.
   */
  get first() {
    if (this.#firstPromise === null) {
      this.#firstPromise = Promise.resolve(this.#firstNow);
    }

    return this.#firstPromise;
  }

  /**
   * @returns {?ChainedEvent} First (earliest-known) event tracked by this
   * instance, if known. This is non-`null` in all cases _except_ when either
   * (a) this instance has yet to observe an event, or (b) it is
   * {@link #advance}d past the end of the chain.
   */
  get firstNow() {
    return this.#firstNow;
  }

  /**
   * Advances this instance to the next event on its tracked chain. It is
   * possible to advance the instance past the end of the chain, in which case
   * the tracked source will need to emit one or more events before {@link
   * #firstNow} becomes non-`null` again.
   */
  advance() {
    if (this.#skipCount >= 0) {
      // We're already at or beyond the end of the chain and waiting for new
      // events to come in.
      this.#skipCount++;
      return;
    }

    const nextNow = this.#firstNow?.nextNow;

    if (nextNow) {
      this.#firstNow     = nextNow;
      this.#firstPromise = null;
    } else {
      // We know `#skipCount === -1` here because of the check at the top of the
      // method. So, what we've been asked to do is advance _just past_ the end
      // of the chain. This is analogous to what happens when an instance was
      // constructed with a promise for `firstEvent`.
      this.#skipCount    = 0;
      this.#firstPromise = this.#handleSkips(this.#firstPromise);
    }
  }

  /**
   * Provides a promised result for {@link #first} while servicing
   * {@link #skipCount}. This class is set up to only ever be in the middle of
   * calling this method once at a time. (This method should get called only
   * when {@link #skipCount} increases to `0` from `-1`.)
   *
   * @param {Promise<ChainedEvent>} firstPromise The value of {@link
   *   #firstPromise} at the moment this method was called. (It immediately
   *   becomes a promise for the result of this method.)
   * @returns {ChainedEvent} Instantaneously correct value for {@link #firstNow}
   *   at the moment this method returns.
   */
  async #handleSkips(firstPromise) {
    // Note: Because of interleaved calls to `advance()` at the point of the
    // `await` below, it's possible for `#skipCount` to increase during the
    // course of this loop.

    while (this.#skipCount >= 0) {
      if (this.#firstNow || !this.#firstPromise) {
        // Shouldn't happen because we aren't supposed to be in this method if
        // `#firstNow` is a known value, and also `#firstPromise` had better be
        // a promise if `#firstNow === null`.
        throw new Error('Shouldn\'t happen.');
      }

      let firstNow = await firstPromise;

      while (firstNow.nextNow && (this.#skipCount > 0)) {
        firstNow = firstNow.nextNow;
        this.#skipCount--;
      }

      if ((this.#skipCount === 0) && firstNow.nextNow) {
        // We skipped enough! We'll exit the loop next go 'round.
        this.#firstNow     = firstNow.nextNow;
        this.#firstPromise = null;
      } else {
        firstPromise = firstNow.next;
      }

      this.#skipCount--;
    }

    return this.#firstNow;
  }
}
