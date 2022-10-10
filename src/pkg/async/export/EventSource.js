// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent } from '#x/ChainedEvent';


/**
 * Event source for a chain of {@link ChainedEvent} instances. It is instances
 * of this class which are generally set up to manage and add new events to a
 * chain, that is, this class represents the authority to emit events on a
 * particular chain (as opposed to it being functionality exposed on
 * `ChainedEvent` itself).
 *
 * This class emits direct instances of {@link ChainedEvent} by default, but it
 * can be made to use a subclass by passing a "kickoff" event to the
 * constructor. The kickoff event becomes the base of the "emission chain." As
 * such, it needs to have its `.emitter` available (never previously accessed).
 *
 * An instance of this class always knows its "current" (latest emitted) event,
 * and a client fetching this and then (asynchronously and iteratively) waiting
 * for its {@link ChainedEvent.nextPromise} is the equivalent of adding a
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
  /** @type {number} How many events has this instance ever emitted. */
  #emittedCount = 0;

  /**
   * @type {number} The number of already-emitted events to keep track of,
   * including the one referenced by {@link #currentEvent}. If infinite, then
   * this instance keeps the entire event chain.
   */
  #keptEventCount = 1;

  /**
   * @type {ChainedEvent} Earliest (furthest in the past) event emitted by this
   * instance which is intentionally being kept by this instance. If this
   * instance has never emitted, then -- as with {@link #currentEvent} -- this
   * is the kickoff event. If this instance isn't keeping any history, then this
   * is always going to be the same as {@link #currentEvent}.
   */
  #earliestEvent;

  /**
   * @type {ChainedEvent} Current (Latest / most recent) event emitted by this
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
   * Constructs an instance. Recognized options:
   *
   * * `{?ChainedEvent} [kickoffEvent = null]` -- "Kickoff" event, or `null` to
   *   use the default of a direct instance of {@link ChainedEvent}.
   *
   * @param {?object} [options = null] Construction options, per the above
   *   description.
   */
  constructor(options) {
    const kickoffEvent = options?.kickoffEvent ?? null;

    this.#earliestEvent = kickoffEvent ?? new ChainedEvent('chain-head');
    this.#currentEvent  = this.#earliestEvent;
    this.#emitNext      = this.#currentEvent.emitter;
  }

  /**
   * @returns {Promise<ChainedEvent>} Promise for the current (latest / most
   * recent) event emitted by this instance. This is an immediately-resolved
   * promise in all cases _except_ when this instance has never emitted an
   * event. In the latter case, it becomes resolved as soon as the first event
   * is emitted.
   *
   * **Note:** Because of the chained nature of events, this property provides
   * access to all subsequent events emitted by this source.
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
   * @returns {?ChainedEvent} Current (Latest / most recent) event emitted by
   * this instance, or `null` if this instance has never emitted an event.
   *
   * **Note:** Because of the chained nature of events, this property (when
   * non-`null`) provides access to all subsequent events emitted by this
   * source.
   */
  get currentEventNow() {
    return (this.#emittedCount > 0) ? this.#currentEvent : null;
  }

  /**
   * Emits (appends to the end of the chain) an event with the given payload.
   *
   * @param {*} payload The event payload.
   * @returns {ChainedEvent} The event that was emitted.
   */
  emit(payload) {
    this.#emitNext     = this.#emitNext(payload);
    this.#currentEvent = this.#currentEvent.nextNow;
    this.#emittedCount++;

    if (this.#emittedCount > this.#keptEventCount) {
      // Steady state: As each new event gets emitted over the `keptEventCount`
      // threshold, we walk `#earliestEvent` one more event down the chain.
      this.#earliestEvent = this.#earliestEvent.nextNow;
    } else if (this.#emittedCount === 1) {
      // After the very first event, we need to skip over the kickoff event.
      this.#earliestEvent = this.#currentEvent;
    }

    return this.#currentEvent;
  }
}
