// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogRecord } from '#x/LogRecord';

import { ChainedEvent, EventSource } from '@this/async';
import { MustBe } from '@this/typey';

/**
 * Event source for use when logging.
 */
export class LogSource extends EventSource {
  /** @type {?ChainedEvent} The "kickoff" event, if still available. */
  #kickoffEvent = new ChainedEvent(LogRecord.makeKickoffInstance());

  /** @type {number} Number of events logged by this instance. */
  #count = 0;

  /**
   * Constructs an instance.
   */
  constructor() {
    const kickoffEvent = new ChainedEvent(LogRecord.makeKickoffInstance());
    super(kickoffEvent);

    this.#kickoffEvent = kickoffEvent;
  }

  /**
   * @returns {ChainedEvent} The earliest available event from this instance.
   * When an instance is first constructed, this is its "kickoff" event; but
   * after the 100th event is logged, this starts tracking the latest logged
   * event. The idea here is that it should take no longer than the time to log
   * that many events for something to get itself hooked up to this instance to
   * start processing events, and we don't want to miss out on flushing out the
   * initial events.
   */
  get earliestEvent() {
    return this.#kickoffEvent ?? this.currentEvent;
  }

  /**
   * Emits an event from this instance's source.
   *
   * @param {LogRecord} record The payload of the event to emit.
   */
  emit(record) {
    MustBe.object(record, LogRecord);

    super.emit(record);

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
