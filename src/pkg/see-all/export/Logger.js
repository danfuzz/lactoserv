// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogTag } from '#x/LogTag';
import { StdLoggingEnvironment } from '#x/StdLoggingEnvironment';

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
  }

  /**
   * Emits a log record to this instance's event chain.
   *
   * @param {string} type The type of event which is being logged.
   * @param {...*} args Arbitrary -- generally speaking, defined per-type --
   *   arguments associated with the event.
   */
  log(type, ...args) {
    this.#environment.emit(this.#tag, type, ...args);
  }


  //
  // Static members
  //

  /** @type {StdLoggingEnvironment} The default logging environment. */
  static #DEFAULT_ENVIRONMENT = new StdLoggingEnvironment();
}
