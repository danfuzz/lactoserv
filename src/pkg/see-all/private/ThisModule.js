// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { LogSource } from '#x/LogSource';
import { StdLoggingEnvironment } from '#x/StdLoggingEnvironment';

import { ChainedEvent } from '@this/async';


/**
 * Un-exported control of this module.
 */
export class ThisModule {
  /**
   * @type {number} Number of events after which {@link #DEFAULT_LOG_SOURCE}
   * drops its kickoff event.
   */
  static #COUNT_WHEN_KICKOFF_DROPPED = 100;

  /** @type {LogSource} Global default log source. */
  static #DEFAULT_LOG_SOURCE = new LogSource(this.#COUNT_WHEN_KICKOFF_DROPPED);

  /** @type {StdLoggingEnvironment} Global default logging environment. */
  static #DEFAULT_ENVIRONMENT = new StdLoggingEnvironment();

  /** @returns {StdLoggingEnvironment} The default logging environment. */
  static get DEFAULT_ENVIRONMENT() {
    return this.#DEFAULT_ENVIRONMENT;
  }

  /** @returns {LogSource} The default log source. */
  static get DEFAULT_LOG_SOURCE() {
    return this.#DEFAULT_LOG_SOURCE;
  }

  /**
   * @returns {ChainedEvent|Promise<ChainedEvent>} The earliest available event
   * from the logging system, or promise for same.
   */
  static get earliestEvent() {
    return this.#DEFAULT_LOG_SOURCE.earliestEvent;
  }
}
