// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource } from '@this/async';

import { LogEvent } from '#x/LogEvent';
import { LogRecord } from '#x/LogRecord';


/**
 * Event source subclass for use when logging.
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
    const kickoffEvent = LogEvent.makeKickoffInstance();
    super({ keepCount, kickoffEvent });
  }

  /**
   * Emits an event from this instance's source.
   *
   * @param {LogRecord} record The payload of the event to emit.
   */
  emit(record) {
    super.emit(record);
  }
}
