// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { EventOrPromise } from '#p/EventOrPromise';
import { EventPayload } from '#x/EventPayload';
import { ManualPromise } from '#x/ManualPromise';


/**
 * Promise-chained event. Each instance becomes chained (linked, as in a linked
 * list) to the next event which gets emitted by the same source. The chain is
 * available both synchronously and asynchronously. In the synchronous case, it
 * is possible to run into the end of the chain, represented by `null`. In the
 * asynchronous case, the properties and accessors return promises that only
 * become resolved once an event has been emitted by the source.
 *
 * As a bit of "ad-hoc type-safety," this class enforces two restrictions:
 *
 * * Any appended (emitted / linked) payload must be an instance of the same
 *   class as the emitting instance's payload. So, e.g., if you construct a
 *   "kickoff event" whose payload is of class `MySpecialPayload`, then all
 *   linked instances will also necessarily have payloads of class
 *   `MySpecialPayload`.
 * * If subclassed, this (base) class will only construct instances of the
 *   actual subclass when appending (emitting / linking) events.
 */
export class LinkedEvent {
  /** @type {EventPayload} The event payload. */
  #payload;

  /**
   * @type {?EventOrPromise} Next event in the chain, if there is in fact either
   * a concrete next event or promise for same.
   */
  #next;

  /** @type {boolean} Is the emitter available for hand-off? */
  #hasEmitter;

  /**
   * @type {?function(*)} Function which can be called to resolve the (promise
   * inside the) value of {@link #next}. `null` if {@link #next} is itself
   * `null` _or_ if the resolver got used.
   */
  #resolveNext = null;

  /**
   * Constructs an instance.
   *
   * @param {EventPayload} payload The event payload.
   * @param {?LinkedEvent|Promise<LinkedEvent>|EventOrPromise} [next]
   *   The next event in the chain or promise for same, if already known. If
   *   passed as non-`null`:
   *   * The value (or eventually-resolved value) is type-checked to be an
   *     instance of this class.
   *   * {@link #emitter} is considered "already used."
   *   * If it is a promise, and it becomes rejected, `nextPromise` on this
   *     instance will get rejected with the same reason.
   *   **Note:** The last type option, `EventOrPromise`, is an internal class
   *   which is used in some of the underlying functionality of this class.
   */
  constructor(payload, next = null) {
    this.#payload = MustBe.instanceOf(payload, EventPayload);

    if (next === null) {
      this.#hasEmitter = true;
      this.#next       = null;
    } else {
      this.#hasEmitter = false;
      this.#next       = (next instanceof EventOrPromise)
        ? next
        : new EventOrPromise(next, this.constructor);
    }
  }

  /**
   * @returns {*[]} The event's argument list, as defined by the {@link
   * #payload}. This just passes through to `.args` on the payload, and
   * guarantees the return type.
   */
  get args() {
    return MustBe.array(this.#payload.args);
  }

  /**
   * Gets a function which emits the next event -- that is, which causes {@link
   * #nextNow} to become known and thus appends a new event to the chain -- and
   * then returns the emitter function for the next-next event.
   *
   * The returned function takes one argument, the payload to emit. When called,
   * it may throw for these reasons:
   * * It was already called successfully, which means there is already a next
   *   event on the chain. (That is, this method can't be used to replace an
   *   already-known next event with another.)
   * * The given payload is considered invalid by the event constructor.
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
    if (this.#hasEmitter) {
      this.#hasEmitter = false;
      return (payload) => {
        const event = this.#emit(payload);
        return event.emitter;
      };
    } else {
      throw new Error('Emitter already handed off.');
    }
  }

  /**
   * @returns {?LinkedEvent} The next event in the chain after this instance if
   * it is immediately available, or `null` if there is not yet a
   * synchronously-known next event.
   * @throws {Error} Thrown if the promise passed into the constructor became
   * rejected or resolved to an invalid value.
   */
  get nextNow() {
    return this.#next?.eventNow ?? null;
  }

  /**
   * @returns {Promise<LinkedEvent>} Promise for the next event in the chain
   * after this instance, which becomes resolved once it is available.
   */
  get nextPromise() {
    if (!this.#next) {
      // This is the first time this getter has been called, and the next event
      // wasn't already known (pre-resolved). So, we set things up for eventual
      // resolution, returning a definitely-unsettled promise.
      const mp = new ManualPromise();
      this.#next        = new EventOrPromise(mp.promise, this.constructor);
      this.#resolveNext = ((value) => mp.resolve(value));
    }

    return this.#next.eventPromise;
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
   * Indicates whether or not a given (alleged) event either _is_ this instance
   * or links to this instance, either directly or indirectly. If the given
   * `event` is not an instance of this class, this method returns `false` (as
   * opposed to throwing an error).
   *
   * @param {*} event (Alleged) event to check.
   * @returns {boolean} `true` iff `event` is either this instance or it links
   *   to this instance (either directly or indirectly).
   */
  isLinkedFrom(event) {
    if (this === event) {
      return true;
    } else if (!(event instanceof LinkedEvent)) {
      return false;
    }

    let at = event.#next;
    while (at) {
      const eventNow = at.eventNow;
      if (eventNow === this) {
        return true;
      }
      at = eventNow?.#next;
    }

    return false;
  }

  /**
   * Constructs a new instance which is set up to be at the head of an event
   * chain which continues with _this_ instance's next event, but with a
   * different payload. Put another way, this method constructs a replacement
   * event for this instance, with the same chaining.
   *
   * @param {*} payload Event payload.
   * @returns {LinkedEvent} New event instance with the given `payload`, and
   *   whose `next` and `nextNow` behave the same as this instance's properties
   *   of the same names.
   */
  withPayload(payload) {
    this.#validatePayload(payload);
    return new this.constructor(payload, this.#next ?? this.nextPromise);
  }

  /**
   * Constructs a new event which -- from its perspective -- has been "pushed"
   * onto the head of the event chain that continues with this instance. That
   * is, the constructed event's `nextPromise` and `nextNow` immediately point
   * at this instance.
   *
   * @param {*} payload Event payload.
   * @returns {LinkedEvent} New event instance with the given `payload`, and
   *   whose `nextPromise` and `nextNow` refer to this instance.
   */
  withPushedHead(payload) {
    this.#validatePayload(payload);
    return new this.constructor(payload, this);
  }

  /**
   * Emits the next event, that is, appends it to the chain and resolves
   * `#next.eventPromise`, if needed.
   *
   * @param {*} payload The event payload.
   * @returns {LinkedEvent} The event which was emitted on the chain.
   * @throws {Error} Thrown for any of the reasons described by {@link
   *   #emitter}.
   */
  #emit(payload) {
    if (this.#next && ((this.#next.isRejected() || this.#next.eventNow))) {
      throw new Error('Can only call next-event emitter once per instance.');
    }

    this.#validatePayload(payload);

    const event = new this.constructor(payload);

    // We always make a new `#next` with a resolved value, so that `.nextNow`
    // maintains its guarantee of being synchronously correct immediately
    // post-emit. E.g., if the original `#next` were promise-bearing, and we
    // just resolved it, then there would be a moment in time after this
    // method completed and before `#next.eventNow` was set in which this
    // instance's state would be inconsistent.
    const next = new EventOrPromise(event, this.constructor);

    if (this.#next) {
      // There have already been one or more calls to `.nextPromise`, so we need
      // to resolve the promise that those calls returned. After that, there is
      // no longer a need to keep the resolver around, so we `null` it out to
      // avoid a bit of garbage accumulation.
      this.#resolveNext(event);
      this.#resolveNext = null;
    }

    this.#next = next;

    return event;
  }

  /**
   * Validates a potential payload.
   *
   * @param {*} payload The payload to check.
   * @throws {Error} Thrown if the payload is not considered valid for emission
   *   by this instance.
   */
  #validatePayload(payload) {
    if (!(payload instanceof this.payload.constructor)) {
      throw new Error('`payload` does not match this instance\'s payload class.');
    }
  }
}
