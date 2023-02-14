// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { LinkedEvent } from '@this/async';
import { StackTrace } from '@this/data-values';
import { MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';
import { LogTag } from '#x/LogTag';


/**
 * Event subclass that holds {@link LogRecord}s as their payloads. It exists for
 * convenience (to avoid having to dig into the payload), for (a little bit of)
 * type safetyl, and for documentation.
 */
export class LogEvent extends LinkedEvent {
  /**
   * Constructs an instance.
   *
   * @param {LogRecord} payload The event payload.
   * @param {?LogEvent|Promise<LogEvent>} [next = null] The next event in the
   *   chain or promise for same, if already known.
   */
  constructor(payload, next) {
    MustBe.instanceOf(payload, LogRecord);
    super(payload, next);
  }

  /** @returns {?StackTrace} Convenient accessor for `payload.stack`. */
  get stack() {
    return this.payload.stack;
  }

  /** @returns {number} Convenient accessor for `payload.atSecs`. */
  get atSecs() {
    return this.payload.atSecs;
  }

  /** @returns {LogTag} Convenient accessor for `payload.tag`. */
  get tag() {
    return this.payload.tag;
  }

  /** @returns {string} Convenient accessor for `payload.type`. */
  get type() {
    return this.payload.type;
  }

  /** @returns {*[]} Convenient accessor for `payload.args`. */
  get args() {
    return this.payload.args;
  }


  //
  // Static members
  //

  /**
   * Constructs a minimal instance of this class, suitable for use as a
   * "kickoff" event passed to the {@link EventSource} constructor.
   *
   * @param {?LogTag} [tag = null] Tag to use for the instance, or `null` to use
   *   a default.
   * @param {?string} [type = null] Type to use for the instance, or `null` to
   *   use a default.
   * @returns {LogEvent} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    const payload = LogRecord.makeKickoffInstance(tag, type);
    return new LogEvent(payload);
  }
}
