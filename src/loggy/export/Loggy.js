// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventSource, LinkedEvent } from '@this/async';
import { LogTag } from '@this/loggy-intf';

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { IntfLogger } from '#x/IntfLogger';
import { LogProxyHandler } from '#p/LogProxyHandler';
import { ThisModule } from '#p/ThisModule';


/**
 * Global control of this module.
 */
export class Loggy {
  /**
   * @returns {LinkedEvent|Promise<LinkedEvent>} The earliest available event
   * from the logging system, or promise for same. This is ultimately
   * implemented by {@link EventSource} (`earliestEvent` and `earliestEventNow`,
   * see which), with a `keepCount` of `100`. The idea here is that it should
   * take no longer than the time to log that many events for something to get
   * itself hooked up to the logging system and start processing events, and we
   * don't want to miss out on early evetns that would otherwise have already
   * become unavailable.
   */
  static get earliestEvent() {
    return ThisModule.earliestEvent;
  }

  /**
   * Constructs a logger instance. See {@link IntfLogger} for details on how to
   * use a logger instance.
   *
   * @param {?LogTag|string|string[]} tag Tag to use on all logged events, or
   *   constructor arguments for same. If `null`, the instance will have no
   *   context tag.
   * @param {BaseLoggingEnvironment} [environment] Logging environment to
   *   use (it's the source for timestamps and stack traces, and what initially
   *   receives all logged events), or `null` to use the default one which is
   *   hooked up to the "real world."
   * @returns {IntfLogger} A logger, as described.
   */
  static loggerFor(tag, environment = null) {
    environment ??= ThisModule.DEFAULT_ENVIRONMENT;
    return LogProxyHandler.makeInstance(tag, environment);
  }
}
