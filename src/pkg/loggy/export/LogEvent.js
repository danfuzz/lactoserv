// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { LinkedEvent } from '@this/async';
import { MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';
import { LogStackTrace } from '#x/LogStackTrace';
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
    MustBe.object(payload, LogRecord);
    super(payload, next);
  }

  /** @type {?LogStackTrace} Convenient accessor for `payload.stack`. */
  get stack() {
    return this.payload.stack;
  }

  /** @type {number} Convenient accessor for `payload.timeSec`. */
  get timeSec() {
    return this.payload.timeSec;
  }

  /** @type {LogTag} Convenient accessor for `payload.tag`. */
  get tag() {
    return this.payload.tag;
  }

  /** @type {string} Convenient accessor for `payload.type`. */
  get type() {
    return this.payload.type;
  }

  /** @type {*[]} Convenient accessor for `payload.args`. */
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
