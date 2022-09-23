// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';
import { ManualPromise } from '#x/ManualPromise';
import { PromiseUtil } from '#x/PromiseUtil';


/**
 * As it says on the tin, a holder for a {@link ChainedEvent} or a promise for
 * same. This combo is used in a few places in the event-handling code in this
 * package.
 */
export class EventOrPromise {
  /** @type {?ChainedEvent} The actual event, if synchronously known. */
  #eventNow;

  /**
   * @type {?Promise<ChainedEvent>} Promise for {@link #headNow}, when that
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
   * so that {@link #headNow} becomes set reasonably promptly.
   *
   * **Note:** If given a promise which resolves to an invalid value (including
   * becoming rejected), {@link #eventNow} will respond by throwing an error.
   * That said, in the case of a promise rejection, the direct rejection is
   * "handled" by this instance, so that no unhandled promise rejections will
   * result just from constructing an instance.
   *
   * @param {ChainedEvent|Promise<ChainedEvent>} event Event or promise to wrap.
   * @param {?function(new:ChainedEvent)} [subclass = null] Subclass which
   *   `event` (or the resolved promise for it) must be an instance of, or
   *   `null` not to require a specific subclass.
   */
  constructor(event, subclass = null) {
    if (event instanceof ChainedEvent) {
      if (EventOrPromise.#eventIsInstanceOf(event, subclass)) {
        this.#eventNow     = event;
        this.#eventPromise = null;
      } else {
        throw new Error('Invalid event value (incorrect class, synchronously known).');
      }
    } else if (event instanceof Promise) {
      // We resolve the promise in an "async-aside" to achieve the specified
      // no-throw behavior. Also note that we can't store `event` directly into
      // `#eventPromise`, because it might not resolve to a valid value, and we
      // maintain a guarantee about the validity of what that resolves to.
      const mp = new ManualPromise();
      this.#eventNow     = null;
      this.#eventPromise = mp.promise;
      (async () => {
        try {
          const eventNow = await event;
          if (eventNow instanceof ChainedEvent) {
            if (EventOrPromise.#eventIsInstanceOf(eventNow, subclass)) {
              mp.resolve(eventNow);
            } else {
              throw new Error('Invalid event value (incorrect class, promise resolution).');
            }
          } else {
            throw new Error('Invalid event value (non-event, promise resolution).');
          }
          this.#eventNow = eventNow;
        } catch (reason) {
          this.#rejectedReason = reason;
          mp.rejectAndHandle(reason);
        }
      })();
    } else {
      throw new Error('Invalid event value (non-event, synchronously known).');
    }
  }

  /**
   * @returns {?ChainedEvent} Synchronously-known event of this instance, if
   * known. This is non-`null` when the constructor was called with an event
   * (not a promise) or when the constructor was called with a promise which
   * became resolved to a valid value.
   * @throws {Error} Thrown if the promise passed in the constructor became
   * rejected or resolved to an invalid value.
   */
  get eventNow() {
    if (this.#rejectedReason) {
      throw this.#rejectedReason;
    }

    return this.#eventNow;
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the -- often not-yet-known --
   * value of {@link #eventNow}. This is an immediately-settled promise in all
   * cases _except_ when this instance was constructed with a promise and that
   * promise has yet to settle. This class guarantees that, if this promise is
   * fulfilled (not rejected), then it will indeed be an instance of {@link
   * ChainedEvent}. This class also guarantees that, if this promise is
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
   * @type {?Error} The synchronously-known reason why {@link #eventPromise} was
   * rejected, if it was indeed rejected and observed by this instance as such.
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
   * @returns {ChainedEvent|Promise<ChainedEvent>} Promise for a "next" event,
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
   * Checks a concrete event instance to see if it is an instance of the
   * indicated class.
   *
   * @param {ChainedEvent} event The event in question.
   * @param {?function(new:ChainedEvent)} cls Class to check for, or `null` to
   *   consider all instances to pass.
   * @returns {boolean} `true` iff `event instanceof cls` or `cls === null`.
   */
  static #eventIsInstanceOf(event, cls) {
    return (cls === null) || (event instanceof cls);
  }
}
