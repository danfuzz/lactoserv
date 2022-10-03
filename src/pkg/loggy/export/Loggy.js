// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogProxyHandler } from '#p/LogProxyHandler';
import { LogTag } from '#x/LogTag';
import { ThisModule } from '#p/ThisModule';

import { ChainedEvent } from '@this/async';


/**
 * Global control of this module.
 */
export class Loggy {
  /**
   * @returns {ChainedEvent|Promise<ChainedEvent>} The earliest available event
   * from the logging system, or promise for same. When the system first starts
   * up, this is the promise for the first actual log event. However, after the
   * 100th event is logged, this instead starts tracking the latest logged
   * event. The idea here is that it should take no longer than the time to log
   * that many events for something to get itself hooked up to the logging
   * system and start processing events, and we don't want to miss out on
   * early evetns that would otherwise have already become unavailable.
   */
  static get earliestEvent() {
    return ThisModule.earliestEvent;
  }

  /**
   * Constructs a logger instance. The returned instance can be used as follows:
   *
   * * `logger(type, ...args)` -- Called directly as a function, to log an event
   *   with the indicated type and arguments. The event uses the tag (context)
   *   passed into _this_ method.
   * * `logger.type(...args)` -- Used as an object to get a particular property
   *   which is then called, to log an event with the indicated type and
   *   arguments. The event uses the tag (context) passed into _this_ method.
   * * `logger.tag.type(...args)` -- Used as an object-of-objects to get a
   *   particular property which is then called, to log an event with the
   *   indicated type and arguments, and with an additional piece of context
   *   appended to the original tag. This form may be used recursively, e.g.
   *   `logger.outer.middle.deep.type('yay!')`, etc.
   * * `logger.$newId` -- Special literal form, which produces a new logger with
   *   a newly-generated ID as additional context. Note that this produces a
   *   result for which function application works like `logger(type)` and not
   *   `logger.type(...args)`.
   *
   * **Note:** The logger function determines its behavior in part by noticing
   * whether it is being called as a function or as a method. For example,
   * `logger.florp('x', 123)` will log `florp('x', 123)` with the logger's
   * default tag; but `(logger.florp || null)('x', 123)` will log `x(123)` with
   * a tag that includes the additional context `florp`.
   *
   * @param {?LogTag|string|string[]} tag Tag to use on all logged events, or
   *   constructor arguments for same. If `null`, the instance will have no
   *   context tag.
   * @param {BaseLoggingEnvironment} [environment = null] Logging environment to
   *   use (it's the source for timestamps and stack traces, and what initially
   *   receives all logged events), or `null` to use the default one which is
   *   hooked up to the "real world."
   * @returns {function(...*)} A logger, as described.
   */
  static loggerFor(tag, environment = null) {
    environment ??= ThisModule.DEFAULT_ENVIRONMENT;
    return LogProxyHandler.makeInstance(tag, environment);
  }
}
