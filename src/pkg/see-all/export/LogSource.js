// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogRecord } from '#x/LogRecord';

import { EventSource } from '@this/async';
import { MustBe } from '@this/typey';

/**
 * Event source for use when logging.
 */
export class LogSource extends EventSource {
  /** @type {?ChainedEvent} The "kickoff" event, if still available. */
  #kickoffEvent = LogRecord.makeKickoffInstance();

  /** @type {number} Number of events logged by this instance. */
  #count = 0;

  /**
   * Constructs an instance.
   *
   * @param {LogTag} tag Tag to use on all logged events.
   * @param {BaseLoggingEnvironment} [environment = null] Logging environment to
   *   use (it's the source for timestamps and stack traces), or `null` to use
   *   the default one which is hooked up to the "real world."
   */
  constructor(tag, environment = null) {
    super(this.#kickoffEvent);
  }

  /**
   * @returns {} The earliest available event from this instance. When
   * an instance is first constructed, this is its "kickoff" event; but after
   * the 100th event is logged, this starts tracking the latest logged event.
   * The idea here is that it should take no longer than the time to log that
   * many events for something to get itself hooked up to this instance to start
   * processing events, and we don't want to miss out on flushing out the
   * initial events.
   */
  get earliestEvent() {
    return this.#kickoffEvent ?? this.#eventSource.currentEvent;
  }

  /**
   * Emits an event from this instance's source.
   *
   * @param {string} type The type of event which is being logged.
   * @param {...*} args Arbitrary -- generally speaking, defined per-type --
   *   arguments associated with the event.
   */
  log(type, ...args) {
    const stack  = this.#environment.stackTrace();
    const nowSec = this.#environment.nowSec();
    const event = new (stack, nowSec, this.#tag, type, Object.freeze(args));

    this.#eventSource.emit(event);
    this.#count++;

    if (this.#count >= LogSource.COUNT_WHEN_KICKOFF_DROPPED) {
      this.#kickoffEvent = null;
    }
  }


  //
  // Static members
  //

  /**
   * @type {number} Number of events after which {@link #kickoffEvent} is no
   * longer available.
   */
  static #COUNT_WHEN_KICKOFF_DROPPED = 100;
}
