// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogEvent } from '#x/LogEvent';
import { LogTag } from '#x/LogTag';
import { StdLoggingEnvironment } from '#x/StdLoggingEnvironment';

import { EventSource } from '@this/async';
import { MustBe } from '@this/typey';

/**
 * Logger, which always logs with a particular {@link LogTag}. This class is a
 * wrapper around an {@link EventSource}, and as such represents the _producing_
 * side of the logging equation.
 */
export class Logger {
  /** @type {LogTag} Tag to use on all logged events. */
  #tag;

  /** @type {BaseLoggingEnvironment} Logging environment to use. */
  #environment;

  /** @type {?LogEvent} The "kickoff" event, if still available. */
  #kickoffEvent;

  /** @type {EventSource} Manager of all the events being emitted. */
  #eventSource;

  /**
   * Constructs an instance.
   *
   * @param {LogTag} tag Tag to use on all logged events.
   * @param {BaseLoggingEnvironment} [environment = null] Logging environment to
   *   use (it's the source for timestamps and stack traces), or `null` to use
   *   the default one which is hooked up to the "real world."
   */
  constructor(tag, environment = null) {
    this.#tag          = MustBe.object(tag, LogTag);
    this.#environment  = environment
      ? MustBe.object(environment, BaseLoggingEnvironment)
      : Logger.DEFAULT_ENVIRONMENT;
    this.#kickoffEvent = LogEvent.makeKickoffInstance(tag);
    this.#eventSource  = new EventSource(this.#kickoffEvent);
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
    const event = new LogEvent(stack, nowSec, this.#tag, type, Object.freeze(args));

    this.#eventSource.emit(event);
  }


  //
  // Static members
  //

  /** @type {StdLoggingEnvironment} The default logging environment. */
  static #DEFAULT_ENVIRONMENT = new StdLoggingEnvironment();
}
