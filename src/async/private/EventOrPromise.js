// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { LinkedEvent } from '#x/LinkedEvent';
import { PromiseUtil } from '#x/PromiseUtil';


/**
 * As it says on the tin, a holder for a {@link LinkedEvent} or a promise for
 * same. This combo is used in a few places in the event-handling code in this
 * package.
 */
export class EventOrPromise {
  /** @type {?LinkedEvent} The actual event, if synchronously known. */
  #eventNow;

  /**
   * @type {?Promise<LinkedEvent>} Promise for {@link #eventNow}, when that
   * property isn't synchronously known _or_ when it's known but something has
   * asked for the promise anyway.
   */
  #eventPromise;

  /**
   * @type {?Error} The reason why {@link #eventPromise} was rejected, if it was
   * indeed rejected.
   */
  #rejectedReason = null;

  /**
   * Constructs an instance. If given a promise, it is pro-actively `await`ed,
   * so that {@link #eventNow} becomes set reasonably promptly.
   *
   * **Note:** If given a promise which resolves to an invalid value (including
   * becoming rejected), {@link #eventNow} will respond by throwing an error.
   * That said, in the case of a promise rejection, the direct rejection is
   * "handled" by this instance, so that no unhandled promise rejections will
   * result just from constructing an instance.
   *
   * @param {LinkedEvent|Promise<LinkedEvent>} event Event or promise to wrap.
   * @param {?function(new:LinkedEvent)} [subclass] Subclass which
   *   `event` (or the resolved promise for it) must be an instance of, or
   *   `null` not to require a specific subclass.
   */
  constructor(event, subclass = null) {
    if (event instanceof Promise) {
      this.#eventNow     = null;
      this.#eventPromise = this.#makePromise(event, subclass);
    } else {
      EventOrPromise.#validateEvent(event, subclass, 'synchronous');
      this.#eventNow     = event;
      this.#eventPromise = null;
    }
  }

  /**
   * @returns {?LinkedEvent} Synchronously-known event of this instance, if
   * in fact known. This is non-`null` when the constructor was called with an
   * event (not a promise) or when the constructor was called with a promise
   * which became resolved to a valid value.
   * @throws {Error} Thrown if the promise passed in the constructor became
   * rejected or resolved to an invalid value, or if this instance was
   * constructed via {@link #reject}.
   */
  get eventNow() {
    if (this.#rejectedReason) {
      throw this.#rejectedReason;
    }

    return this.#eventNow;
  }

  /**
   * @returns {Promise<LinkedEvent>} Promise for the -- often not-yet-known --
   * value of {@link #eventNow}. This is an immediately-settled promise in all
   * cases _except_ when this instance was constructed with a promise and that
   * promise has yet to settle. This class guarantees that, if this promise is
   * fulfilled (not rejected), then it will indeed be an instance of {@link
   * LinkedEvent}. This class also guarantees that, if this promise is
   * rejected, then {@link #rejectedReason} is non-`null`.
   */
  get eventPromise() {
    if (this.#eventPromise === null) {
      // When `#eventPromise` is `null`, `#eventNow` is always supposed to be a
      // valid event.
      this.#eventPromise = Promise.resolve(this.#eventNow);
    }

    return this.#eventPromise;
  }

  /**
   * @returns {EventOrPromise} Instance of this class representing the next
   * event on the chain after the one wrapped by this instance.
   */
  get next() {
    const eventNow = this.#eventNow;

    if (eventNow) {
      return new EventOrPromise(eventNow.nextNow ?? eventNow.nextPromise);
    } else {
      return new EventOrPromise(this.#nextFromPromise());
    }
  }

  /**
   * @returns {?Error} The synchronously-known reason why {@link #eventPromise}
   * was rejected, if it was indeed rejected and observed by this instance as
   * such.
   */
  get rejectedReason() {
    return this.#rejectedReason;
  }

  /**
   * Indicates whether this instance is synchronously known to have a rejected
   * {@link #eventPromise}.
   *
   * @returns {boolean} `true` iff {@link #eventPromise} is rejected.
   */
  isRejected() {
    return this.#rejectedReason !== null;
  }

  /**
   * Helper for the constructor, which resolves and validates the
   * originally-supplied `event` promise, which the constructor is expected to
   * (must!) store into {@link #eventPromise}. In particular, this method
   * ensures that the synchronously-returned promise (from this `async` method)
   * only ever resolves to a valid event instance, and that this instance's
   * synchronous state is properly updated before the promise becomes resolved.
   *
   * @param {Promise<LinkedEvent>} eventPromise `event` from the constructor
   *   call.
   * @param {?function(new:LinkedEvent)} subclass `subclass` from the
   *   constructor call.
   * @returns {LinkedEvent} The valid fulfilled value of `eventPromise` if it
   *   was indeed fulfilled as a valid event instance.
   * @throws {Error} Thrown if there was any trouble with resolution.
   */
  async #makePromise(eventPromise, subclass) {
    try {
      const eventNow = await eventPromise;

      EventOrPromise.#validateEvent(eventNow, subclass, 'resolved promise');
      this.#eventNow = eventNow;
      return eventNow;
    } catch (reason) {
      this.#rejectedReason = reason;

      // What's going on here: The `throw` below is going to cause the existing
      // `#eventPromise` to be rejected -- because the promise returned from
      // this method has already been stored there -- but this class guarantees
      // that this situation won't cause an "unhandled promise rejection." So,
      // we proactively get it handled.
      PromiseUtil.handleRejection(this.#eventPromise);
      throw reason;
    }
  }

  /**
   * @returns {LinkedEvent|Promise<LinkedEvent>} Promise for a "next" event,
   * either a settled one or a promise.
   */
  async #nextFromPromise() {
    const eventNow = await this.#eventPromise;
    return eventNow.nextNow ?? eventNow.nextPromise;
  }


  //
  // Static members
  //

  /**
   * Constructs an instance that comes into the world in a synchronously-known
   * rejected-and-handled state. This is different than passing a rejected
   * promise in the main constructor, because in that form this class can't
   * actually tell that it's broken (without breaking the JavaScript object
   * model).
   *
   * @param {Error} reason The reason for rejection.
   * @returns {EventOrPromise} An appropriately-constructed instance.
   */
  static reject(reason) {
    const promise = PromiseUtil.rejectAndHandle(reason);
    const result  = new this(promise);

    result.#rejectedReason = reason;
    return result;
  }

  /**
   * Checks an alleged event instance to see if it is (a) actually an instance
   * of `LinkedEvent` and optionally an instance of a specific subclass
   * thereof.
   *
   * @param {LinkedEvent} event The event in question.
   * @param {?function(new:LinkedEvent)} subclass Class to check for, or `null`
   *   to consider all `LinkedEvent` instances okay.
   * @param {string} context Context to include in error messages.
   * @throws {Error} Thrown if `event` is problematic.
   */
  static #validateEvent(event, subclass, context) {
    if (event instanceof LinkedEvent) {
      if ((subclass !== null) && !(event instanceof subclass)) {
        throw new Error(`Invalid event value (incorrect class, ${context}).`);
      }
    } else {
      throw new Error(`Invalid event value (non-event, ${context}).`);
    }
  }
}
