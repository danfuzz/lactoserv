// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource, LinkedEvent } from '@this/async';
import { StackTrace } from '@this/data-values';
import { MustBe } from '@this/typey';

import { LogPayload } from '#x/LogPayload';
import { LogTag } from '#x/LogTag';


/**
 * Event subclass that holds {@link LogPayload}s as their payloads. It exists for
 * convenience (to avoid having to dig into the payload), for (a little bit of)
 * type safety, and for documentation.
 */
export class LogEvent extends LinkedEvent {
  /**
   * Constructs an instance.
   *
   * @param {LogPayload} payload The event payload.
   * @param {?LogEvent|Promise<LogEvent>} [next = null] The next event in the
   *   chain or promise for same, if already known.
   */
  constructor(payload, next) {
    MustBe.instanceOf(payload, LogPayload);
    super(payload, next);
  }

  /** @returns {*[]} Convenient accessor for `payload.args`. */
  get args() {
    return this.payload.args;
  }

  /** @returns {?StackTrace} Convenient accessor for `payload.stack`. */
  get stack() {
    return this.payload.stack;
  }

  /** @returns {LogTag} Convenient accessor for `payload.tag`. */
  get tag() {
    return this.payload.tag;
  }

  /** @returns {string} Convenient accessor for `payload.type`. */
  get type() {
    return this.payload.type;
  }

  /** @returns {number} Convenient accessor for `payload.when`. */
  get when() {
    return this.payload.when;
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
    const payload = LogPayload.makeKickoffInstance(tag, type);
    return new LogEvent(payload);
  }

  /**
   * Makes an {@link EventSource} which uses a "kickoff" event constructed by
   * {@link #makeKickoffInstance}. Since the kickoff event is an instance of
   * this class, the so-constructed event source is constrained to only ever
   * emit instances of this class.
   *
   * @param {object} [options = {}] Configuration options.
   * @param {number} [options.keepCount = 0] Number of older events to maintain
   *   in the source, as per {@link EventSource#constructor}.
   * @param {?LogTag} [options.tag = null] Tag to use, as per {@link
   *   #makeKickoffInstance}.
   * @param {?string} [options.type = null] Type to use, as per {@link
   *   #makeKickoffInstance}.
   * @returns {EventSource} An event source, as specified.
   */
  static makeSource(options = {}) {
    const {
      keepCount = 0,
      tag       = null,
      type      = null
    } = options;

    const kickoffEvent = this.makeKickoffInstance(tag, type);
    return new EventSource({ keepCount, kickoffEvent });
  }
}
