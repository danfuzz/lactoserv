// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LinkedEvent, EventSource } from '@this/async';
import { MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';


/**
 * Event source for use when logging.
 */
export class LogSource extends EventSource {
  /**
   * Constructs an instance.
   *
   * @param {number} [keepCount = 0] Number of older events to keep available
   *   via {@link EventSource.earliestEvent} and {@link
   *   EventSource.earliestEventNow}.
   */
  constructor(keepCount = 0) {
    const kickoffEvent = new LinkedEvent(LogRecord.makeKickoffInstance());
    super({ keepCount, kickoffEvent });
  }

  /**
   * Emits an event from this instance's source.
   *
   * @param {LogRecord} record The payload of the event to emit.
   */
  emit(record) {
    MustBe.object(record, LogRecord);
    super.emit(record);
  }
}
