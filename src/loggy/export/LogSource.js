// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource } from '@this/async';

import { LogEvent } from '#x/LogEvent';
import { LogRecord } from '#x/LogRecord';


// TODO: Perhaps this class should be removed? Its only value is to ensure that
// the emitted events are of class `LogRecord`. As such, this class could be
// replaced by a utility method on `LogEvent` which just passes a good kickoff
// instance.

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
}
