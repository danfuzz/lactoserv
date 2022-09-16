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
 * **Note:** This class does _not_ remember any events ever emitted by itself
 * other than the most recent, because doing otherwise would cause a garbage
 * accumulation issue. (Imagine a single instance of this class being actively
 * used in a process which runs for, say, a month.)
 */
export class EventSource {
  /** @type {boolean} Has this instance ever emitted an event? */
  #everEmitted = false;

  /**
   * @type {ChainedEvent} Current (Latest / most recent) event emitted by this
   * instance. If this instance has never emitted, this is an initial "stub"
   * which is suitable for `await`ing in {@link #currentEvent}. (This
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
   * @param {?ChainedEvent} [kickoffEvent = null] "Kickoff" event, or `null`
   *   to default to using a direct instance of {@link ChainedEvent}.
   */
  constructor(kickoffEvent = null) {
    this.#currentEvent = kickoffEvent ?? new ChainedEvent('chain-head');
    this.#emitNext = this.#currentEvent.emitter;
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
    if (this.#everEmitted) {
      // `#currentEvent` is in fact a truly emitted event.
      return this.#currentEvent;
    } else {
      // `#currentEvent` is just the initial stub that was made during
      // construction of this instance. _Its_ chained `next` event will be the
      // first actual event coming from this instance.
      return this.#currentEvent.next;
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
    return this.#everEmitted ? this.#currentEvent : null;
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
    this.#everEmitted  = true;

    return this.#currentEvent;
  }
}
