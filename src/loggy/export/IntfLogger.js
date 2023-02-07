// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods } from '@this/typey';

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';


/**
 * Interface for loggers, as used by this system. Loggers accept arbitrary
 * ad-hoc structured messages and pass them on (generally, queue them up on an
 * event queue of some sort) for eventual writing / transmitting to one or more
 * event sinks.
 *
 * To use a logger, simply invoke any method on it, passing it arbitrary
 * arguments, and a message with the method's name and those arguments gets
 * logged. For example, given a logger called `logger`, calling the method
 * `logger.someName(1, 2, 'three')` logs the structured message `someName(1, 2,
 * 'three')` to whatever source the logger is attached to. The method name --
 * called the "event type" in this context -- along with the arguments and other
 * context from the logger instance become part of a `LogRecord` in a
 * `LogEvent`.
 *
 * Every logger has a "tag" which gets associated with each event logged through
 * it. A tag is an ordered list of context strings, including a "main" one (e.g.
 * and typically the overall component of the system it is associated with) and
 * zero or more additional layers of context. To create a new sublogger -- that
 * is a logger with an additional context string -- simply access the property
 * with the context as a name without invoking it as a method. For example,
 * `logger.subComponent` is a logger which has `'subComponent'` appended to its
 * tag, and likewise `logger.subComponent.someName('stuff')` will log the event
 * `someName('stuff')` with a tag that includes the logger's original context
 * plus `'subComponent'`. This can be arbitrarily chained, e.g.
 * `logger.yes.you.can.keep.going('yay!')`.
 *
 * Beyond the arbitrary names used to queue up events and create subloggers,
 * there are a few special names that can be used to access metainformation
 * about a logger. These are all documented as properties on this class.
 *
 * As an uncommonly-used sorta-special case (which really falls out from the
 * rest of the structure of the system), a logger can be called directly as a
 * function, in which case the first argument is the event type and the _rest_
 * of the arguments are the event arguments. That is, `logger('someName', 123)`
 * is equivalent to `logger.someName(123)`.
 *
 * **Note:** Under the covers (unsurprisingly) every logger instance is in fact
 * a proxy. A logger determines its behavior in part by noticing whether it is
 * being called as a function or as a method. For example, `logger.florp('x',
 * 123)` will log `florp('x', 123)` with the logger's default tag; but
 * `(logger.florp || null)('x', 123)` will log `x(123)` with a tag that includes
 * the additional context `florp`.
 *
 * @interface
 */
export class IntfLogger {
  /**
   * @returns {BaseLoggingEnvironment} The logging environment used by this
   * instance.
   */
  get $env() {
    return Methods.abstract();
  }

  /**
   * @returns {object} Metainformation about this instance.
   * TODO: Extract a base class of `Meta` from the proxy class, so this can be
   * properly documented.
   */
  get $meta() {
    return Methods.abstract();
  }

  /**
   * @returns {IntfLogger} A logger which has as added context a new ID
   * generated by this instance's environment.
   */
  get $newId() {
    return Methods.abstract();
  }
}
