// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ManualPromise } from '#x/ManualPromise';

import { MustBe } from '@this/typey';

// TODO:
// * earliestOf
// * earliestOfNow
// * latestOf
// * latestOfNow
// * nextOf
// * nextOfNow
// * withPushedHead

/**
 * Promise-chained event. Each instance becomes chained to the next event which
 * gets emitted by the same source. The chain is available both synchronously
 * and asynchronously. In the synchronous case, it is possible to run into the
 * end of the chain, represented by `null`. In the asynchronous case, the
 * properties and accessors return promises that only become resolved once an
 * appropriate event has been emitted by the source.
 *
 * It is possible -- and appropriate -- to subclass this class. If subclassed,
 * this (base) class will only construct instances of the actual subclass when
 * appending (chaining) emitted events.
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
   * @type {?Promise<ChainedEvent>} Promise representing the next event in the
   * chain, or `null` if there are no pending requests for same.
   */
  #nextPromise = null;

  /**
   * @type {?function(*)} Function which can be called to resolve the value of
   * {@link #nextPromise}. `null` if {@link #nextPromise} is itself `null` _or_
   * if the resolver got used.
   */
  #nextResolver = null;

  /** @type {boolean} Is the emitter available for hand-off? */
  #emitterAvailable = true;

  /**
   * Constructs an instance.
   *
   * @param {*} payload The event payload.
   * @param {?ChainedEvent|Promise<ChainedEvent>} [next = null] The next event
   *   in the chain or promise for same, if already known. If passed as
   *   non-`null`:
   *   * The value (or eventually-resolved value) is type-checked to be an
   *     instance of this class.
   *   * If it is a promise, and it becomes rejected, `next` on this instance
   *     will get rejected with the same reason.
   *   * {@link #emitter} is considered "already used."
   */
  constructor(payload, next = null) {
    this.#payload = payload;

    if (next !== null) {
      this.#emitterAvailable = false;
      if (next instanceof Promise) {
        // Arrange for `nextNow` to get set and `next` to resolve, when the
        // incoming when `next` ultimately resolves, but only if it's valid!
        const mp = new ManualPromise();
        this.#nextPromise = mp.promise;
        (async () => {
          try {
            const nextNow = await next;
            if (!(nextNow instanceof this.constructor)) {
              throw new Error('Wrong instance type for resolved `next`.');
            }
            this.#nextNow = nextNow;
            mp.resolve(nextNow);
          } catch (e) {
            mp.reject(e);
          }
        })();
      } else if (next instanceof this.constructor) {
        this.#nextNow = next;
      } else {
        throw new Error('Wrong instance type for pre-resolved `next`.');
      }
    }
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
   * @returns {Promise<ChainedEvent>} Promise for the next event in the chain
   * after this instance, which becomes resolved once it is available.
   */
  get next() {
    if (this.#nextPromise) {
      return this.#nextPromise;
    } else if (this.#nextNow) {
      this.#nextPromise = Promise.resolve(this.#nextNow);
      return this.#nextPromise;
    }

    // This is the first time `next` has been called, and the next event isn't
    // yet known. So, we set things up for eventual resolution, returning a
    // definitely-unsettled promise.

    const mp = new ManualPromise();
    this.#nextPromise = mp.promise;
    this.#nextResolver = (value => mp.resolve(value));

    return this.#nextPromise;
  }

  /**
   * @returns {?ChainedEvent} The next event in the chain after this instance if
   * it is immediately available, or `null` if there is not yet a next event.
   */
  get nextNow() {
    return this.#nextNow;
  }

  /** @returns {*} The event payload. */
  get payload() {
    return this.#payload;
  }

  /**
   * @returns {string} The event's type, as defined by the {@link #payload}.
   * This just passes through to `.type` on the payload, and guarantees the
   * return type.
   */
  get type() {
    return MustBe.string(this.#payload.type);
  }

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
  withPayload(payload) {
    return new this.constructor(payload, this.#nextNow ?? this.next);
  }

  /**
   * Constructs a new event which -- from its perspective -- has been "pushed"
   * onto the head of the event chain that continues with this instance. That
   * is, the constructed event's `next` and `nextNow` immediately point at this
   * instance.
   *
   * @param {*} payload Event payload.
   * @returns {ChainedEvent} New event instance with the given `payload`, and
   *   whose `next` and `nextNow` refer to this instance.
   */
  withPushedHead(payload) {
    return new this.constructor(payload, this);
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

    if (this.#nextPromise) {
      // There have already been one or more calls to `.next`, so we need to
      // resolve the promise that those calls returned. After that, there is no
      // longer a need to keep the resolver around, so we `null` it out to avoid
      // a bit of garbage accumulation. (We keep the promise around, though,
      // because it's reasonably expectable for `.next` to be called again.)
      this.#nextResolver(this.#nextNow);
      this.#nextResolver = null;
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
