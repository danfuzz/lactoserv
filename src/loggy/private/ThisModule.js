// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource, LinkedEvent } from '@this/async';

import { LogPayload } from '#x/LogPayload';
import { StdLoggingEnvironment } from '#x/StdLoggingEnvironment';


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * @type {number} Number of old events that {@link #DEFAULT_LOG_SOURCE} keeps.
   */
  static #DEFAULT_KEEP_COUNT = 100;

  /** @type {EventSource} Global default log source. */
  static #DEFAULT_LOG_SOURCE = new EventSource({
    keepCount:      this.#DEFAULT_KEEP_COUNT,
    kickoffPayload: LogPayload.makeKickoffInstance()
  });

  /** @type {StdLoggingEnvironment} Global default logging environment. */
  static #DEFAULT_ENVIRONMENT =
    new StdLoggingEnvironment(this.#DEFAULT_LOG_SOURCE);

  /** @returns {StdLoggingEnvironment} The default logging environment. */
  static get DEFAULT_ENVIRONMENT() {
    return this.#DEFAULT_ENVIRONMENT;
  }

  /** @returns {EventSource} The default log source. */
  static get DEFAULT_LOG_SOURCE() {
    return this.#DEFAULT_LOG_SOURCE;
  }

  /**
   * @returns {LinkedEvent|Promise<LinkedEvent>} The earliest available event
   * from the logging system, or promise for same.
   */
  static get earliestEvent() {
    const source = this.#DEFAULT_LOG_SOURCE;

    return source.earliestEventNow ?? source.earliestEvent;
  }
}
