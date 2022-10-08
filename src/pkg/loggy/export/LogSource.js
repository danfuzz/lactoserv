// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ChainedEvent, EventSource } from '@this/async';
import { MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';


/**
 * Event source for use when logging.
 */
export class LogSource extends EventSource {
  /** @type {?ChainedEvent} The "kickoff" event, if still available. */
  #kickoffEvent;

  /**
   * @type {number} Number of events logged by this instance, after which
   * {@link #kickoffEvent} is to be dropped.
   */
  #countRemaining;

  /**
   * Constructs an instance.
   *
   * @param {number} [initialCount = 1] Number of events logged by this
   *   instance, after which {@link #earliestEvent} is no longer the actual
   *   earliest event.
   */
  constructor(initialCount = 1) {
    const kickoffEvent = new ChainedEvent(LogRecord.makeKickoffInstance());
    super(kickoffEvent);

    this.#kickoffEvent   = kickoffEvent;
    this.#countRemaining = MustBe.number(initialCount);
  }

  /**
   * @returns {ChainedEvent|Promise<ChainedEvent>} The earliest available event
   * from this instance, or promise for same. This is a promise for the
   * "kickoff" event's `.next` until the configured number of events have been
   * emitted.
   */
  get earliestEvent() {
    return this.#kickoffEvent
      ? this.#kickoffEvent.nextPromise
      : this.currentEvent;
  }

  /**
   * Emits an event from this instance's source.
   *
   * @param {LogRecord} record The payload of the event to emit.
   */
  emit(record) {
    MustBe.object(record, LogRecord);

    super.emit(record);

    if (this.#kickoffEvent) {
      this.#countRemaining--;
      if (this.#countRemaining <= 0) {
        this.#kickoffEvent = null;
      }
    }
  }
}
