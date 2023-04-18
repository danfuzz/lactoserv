// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { EventPayload } from '#x/EventPayload';
import { LinkedEvent } from '#x/LinkedEvent';


/**
 * Event source for a chain of {@link LinkedEvent} instances. It is instances
 * of this class which are generally set up to manage and add new events to a
 * chain, that is, this class represents the authority to emit events on a
 * particular chain (as opposed to it being functionality exposed on
 * `LinkedEvent` itself).
 *
 * This class emits direct instances of {@link LinkedEvent} by default, but it
 * can be made to use a subclass by passing a "kickoff" event to the
 * constructor. The kickoff event becomes the base of the "emission chain." As
 * such, it needs to have its `.emitter` available (never previously accessed).
 *
 * An instance of this class always knows its "current" (latest emitted) event,
 * and a client fetching this and then (asynchronously and iteratively) waiting
 * for its {@link LinkedEvent.nextPromise} is the equivalent of adding a
 * listener in the `EventEmitter` model.
 *
 * Instances do not by default keep track of any events emitted other than the
 * most recent, but this is configurable. It is sometimes beneficial for an
 * instance to remember the last N events emitted (for a small fixed-size N),
 * and in _some_ circumstances it may be desirable for an instance to remember
 * _every_ event ever emitted. However, note that in this last case there is a
 * danger of a garbage-accumulation issue, especially for instances which are
 * expected to last indefinitely. (Imagine an instance of this class being
 * actively used in a process which runs for, say, several months.)
 */
export class EventSource {
  /**
   * @type {number} The number of already-emitted events to keep track of,
   * not including the one referenced by {@link #currentEvent}. If infinite,
   * then this instance keeps the entire event chain.
   */
  #keepCount;

  /** @type {number} How many events has this instance ever emitted. */
  #emittedCount = 0;

  /**
   * @type {LinkedEvent} Earliest (furthest in the past) event emitted by this
   * instance which is intentionally being kept by this instance. If this
   * instance has never emitted, then -- as with {@link #currentEvent} -- this
   * is the kickoff event. If this instance isn't keeping any history, then this
   * is always going to be the same as {@link #currentEvent}.
   */
  #earliestEvent;

  /**
   * @type {LinkedEvent} Current (Latest / most recent) event emitted by this
   * instance. If this instance has never emitted, this is an initial "kickoff
   * event" which is suitable for `await`ing in {@link #currentEvent}. (This
   * arrangement makes the logic in {@link #emit} particularly simple.)
   */
  #currentEvent;

  /**
   * @type {function(*)} Function to call in order to emit the next event on the
   * chain.
   */
  #emitNext;

  /**
   * Constructs an instance.
   *
   * @param {?object} [options = null] Construction options.
   * @param {number} [options.keepCount = 0] Number of past events to keep
   *   (remember), not including the current (most-recently emitted) event.
   *   Must be a whole number or positive infinity.
   * @param {?LinkedEvent} [options.kickoffEvent = null] "Kickoff" event, or
   *   `null` to use `options.kickoffPayload` (below). It is not valid to
   *   specify both this and `kickoffPayload`.
   * @param {?EventPayload} [options.kickoffPayload = null] Payload for the
   *   "kickoff" event, or `null` to use the default of the result of a call to
   *   {@link EventPayload#makeKickoffInstance}. The event itself is a direct
   *   instance of {@link LinkedEvent}. It is not valid to specify both this and
   *   `kickoffEvent`.
   */
  constructor(options = null) {
    const {
      keepCount      = 0,
      kickoffEvent   = null,
      kickoffPayload = null
    } = options ?? {};

    if (keepCount !== Number.POSITIVE_INFINITY) {
      MustBe.number(keepCount, { safeInteger: true });
    }

    if (kickoffEvent) {
      if (kickoffPayload) {
        throw new Error('Cannot specify both `kickoffEvent` and `kickoffPayload`');
      }
      this.#earliestEvent = MustBe.instanceOf(kickoffEvent, LinkedEvent);
    } else {
      const payload = kickoffPayload
        ? MustBe.instanceOf(kickoffPayload, EventPayload)
        : EventPayload.makeKickoffInstance();
      this.#earliestEvent = new LinkedEvent(payload);
    }

    this.#keepCount    = keepCount;
    this.#currentEvent = this.#earliestEvent;
    this.#emitNext     = this.#currentEvent.emitter;
  }

  /**
   * @returns {Promise<LinkedEvent>} Promise for the current (latest / most
   * recent) event emitted by this instance. This is an immediately-resolved
   * promise in all cases _except_ when this instance has never emitted an
   * event. In the latter case, it becomes resolved as soon as the first event
   * is emitted.
   *
   * **Note:** Because of the chained nature of events, this property provides
   * access to all subsequent events emitted by this source.
   *
   * **Note:** The "kickoff" event is never considered to be emitted. As such,
   * this getter will never return it.
   */
  get currentEvent() {
    if (this.#emittedCount > 0) {
      // `#currentEvent` is in fact a truly emitted event.
      return Promise.resolve(this.#currentEvent);
    } else {
      // `#currentEvent` is just the initial stub that was made during
      // construction of this instance. _Its_ chained `nextPromise` will be the
      // first actual event coming from this instance.
      return this.#currentEvent.nextPromise;
    }
  }

  /**
   * @returns {?LinkedEvent} Current (Latest / most recent) event emitted by
   * this instance, or `null` if this instance has never emitted an event.
   *
   * **Note:** Because of the chained nature of events, this property (when
   * non-`null`) provides access to all subsequent events emitted by this
   * source.
   *
   * **Note:** The "kickoff" event is never considered to be emitted. As such,
   * this getter will never return it.
   */
  get currentEventNow() {
    return (this.#emittedCount > 0) ? this.#currentEvent : null;
  }

  /**
   * @returns {Promise<LinkedEvent>} Promise for the earliest event kept by
   * this instance. This is an immediately-resolved promise in all cases
   * _except_ when this instance has never emitted an event.
   *
   * **Note:** The "kickoff" event is never considered to be emitted. As such,
   * this getter will never return it.
   */
  get earliestEvent() {
    // Same logic as for `currentEvent()`, see which.
    return (this.#emittedCount > 0)
      ? Promise.resolve(this.#earliestEvent)
      : this.#earliestEvent.nextPromise;
  }

  /**
   * @returns {?LinkedEvent} The earliest event kept by this instance, or
   * `null` if this instance has never emitted an event.
   *
   * **Note:** The "kickoff" event is never considered to be emitted. As such,
   * this getter will never return it.
   */
  get earliestEventNow() {
    return (this.#emittedCount > 0) ? this.#earliestEvent : null;
  }

  /**
   * @returns {number} The number of already-emitted events that this instance
   * keeps track of, not including the current (most-recently emitted) event.
   * Might be infinite. The earliest such event is available as {@link
   * #earliestEvent} and {@link #earliestEventNow}.
   */
  get keepCount() {
    return this.#keepCount;
  }

  /**
   * Emits (appends to the end of the chain) an event with the given payload.
   *
   * @param {*} payload The event payload.
   * @returns {LinkedEvent} The event that was emitted.
   */
  emit(payload) {
    this.#emitNext     = this.#emitNext(payload);
    this.#currentEvent = this.#currentEvent.nextNow;

    if (this.#emittedCount > this.#keepCount) {
      // Steady state (which also applies if `keepCount === 0`): As each new
      // event gets emitted over the `keepCount` threshold, we walk
      // `#earliestEvent` one more event down the chain.
      this.#earliestEvent = this.#earliestEvent.nextNow;
    } else if (this.#emittedCount === 0) {
      // After the very first event, we need to skip over the kickoff event.
      this.#earliestEvent = this.#currentEvent;
    }

    this.#emittedCount++;

    return this.#currentEvent;
  }

  /**
   * Indicates whether or not a given (alleged) event is linked into the chain
   * that ends at the head of this instance, or if it is the head itself. If the
   * given `event` is not an instance of {@link LinkedEvent}, this method
   * returns `false` (as opposed to throwing an error).
   *
   * @param {*} event (Alleged) event to check.
   * @returns {boolean} `true` iff `event` is in fact an event instance and it
   *   is either the head of this instance (the most-recently emitted event) or
   *   it links to the head of this instance (either directly or indirectly).
   */
  isLinkedFrom(event) {
    return this.#currentEvent.isLinkedFrom(event);
  }
}
