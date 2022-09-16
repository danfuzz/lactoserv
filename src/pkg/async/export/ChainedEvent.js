// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ManualPromise } from '#x/ManualPromise';

/**
 * Promise-chained event.
 */
export class ChainedEvent {
  /** @type {*} The event payload. */
  #payload;

  /**
   * @type {?ChainedEvent} Next event in the chain, if there is in fact a next
   * event in the chain.
   */
  #nextNow = null;

  /**
   * @type {?ManualPromise<ChainedEvent>} Promise representing the next event in
   * the chain, or `null` if there are no pending requests for same.
   */
  #nextProm = null;

  /** @type {boolean} Is the emitter available for hand-off? */
  #emitterAvailable = true;

  /**
   * Constructs an instance.
   *
   * @param {*} payload The event payload.
   */
  constructor(payload) {
    this.#payload = payload;
  }

  /**
   * Gets a function which emits the next event -- that is, which causes {@link
   * #nextNow} to become known and thus appends a new event to the chain -- and
   * then returns the emitter function for the next-next event.
   *
   * It is only valid to ever use this getter once per instance, so that the
   * "chain of custody" of the event chain can be maintained. That is, just
   * because something has a reference to this instance doesn't mean that it can
   * emit on (append to) the chain. And in fact, the function returned by this
   * getter will always call this method on the newly-created next event before
   * anything else can, which means that the only way to ever use this getter
   * successfully is to start a new chain by directly using `new` to construct
   * an instance of this class.
   *
   * @returns {function(*): function(*)} The next-event emitter function.
   * @throws {Error} Thrown if this method has already been called on this
   *   instance.
   */
  get emitter() {
    if (this.#emitterAvailable) {
      this.#emitterAvailable = false;
      return (payload => this.#emitter0(payload));
    } else {
      throw new Error('Emitter already handed off.');
    }
  }

  /**
   * @type {Promise<ChainedEvent>} Promise for the next event in the chain after
   * this instance, which becomes resolved once it is available.
   */
  get next() {
    if (this.#nextNow) {
      return Promise.resolve(this.#nextNow);
    }

    // This event is currently at the tail of the chain, so the result will be
    // an unresolved promise.

    if (this.#nextProm === null) {
      // This is the first time `next` has been called, so set up the promise.
      this.#nextProm = new ManualPromise();
    }

    return this.#nextProm.promise;
  }

  /**
   * @type {?ChainedEvent} The next event in the chain after this instance if it
   * is immediately available, or `null` if there is not yet a next event.
   */
  get nextNow() {
    return this.#nextNow;
  }

  /** @type {*} The event payload. */
  get payload() {
    return this.#payload;
  }

  // TODO:
  // * earliestOf
  // * earliestOfNow
  // * latestOf
  // * latestOfNow
  // * nextOf
  // * nextOfNow
  // * withPushedHead

  /**
   * Constructs a new instance which is set up to be at the head of an event
   * chain which continues with _this_ instance's next event, but with a
   * different payload. Put another way, this method constructs a replacement
   * event for this instance, with the same chaining.
   *
   * @param {*} payload Event payload.
   * @returns {ChainedEvent} New event instance with the given `payload`, and
   *   whose `next` and `nextNow` behave the same as this instance's properties
   *   of the same names.
   */
  withNewPayload(payload) {
    const result = new this.constructor(payload);

    // The result's emitter isn't available, because the chain of custody has
    // already been taken (or will be taken, or at least _should_ have been
    // taken) by whatever emitted _this_ instance.
    result.#emitterAvailable = false;

    if (this.#nextNow) {
      // This instance already knows its next event, so set up the result with
      // the same one.
      result.#nextNow = this.#nextNow;
    } else {
      // This instance is currently at the tail of the event chain. Wait for its
      // `next`, and propagate that to the result.
      (async () => {
        result.#emit(await this.next);
      })();
    }

    return result;
  }

  /**
   * Emits the next event, that is, appends it to the chain and resolves the
   * `next` promise, if needed.
   *
   * @param {ChainedEvent} event The event.
   */
  #emit(event) {
    if (this.#nextNow) {
      throw new Error('Can only call next-event emitter once per instance.');
    }

    this.#nextNow = event;

    if (this.#nextProm) {
      // There have already been one or more calls to `.next`, so we need to
      // resolve the promise that those calls returned. After that, there is no
      // longer a need to keep the promise (and accoutrements) around, so we
      // `null` it out.
      this.#nextProm.resolve(this.#nextNow);
      this.#nextProm = null;
    }
  }

  /**
   * Constructs an event from the given payload and emits it as the next event
   * on the chain, returning the next-next emitter. The return value from
   * {@link #emitter} is a wrapped call to this method.
   *
   * @param {*} payload The event payload.
   * @returns {function(*): function(*)} The next-next-event emitter function.
   */
  #emitter0(payload) {
    const event = new this.constructor(payload);

    this.#emit(event);
    return event.emitter;
  }
}
