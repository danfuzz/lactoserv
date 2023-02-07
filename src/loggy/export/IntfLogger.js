// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods } from '@this/typey';


/**
 * Interface for loggers, as used by this system. Loggers accept arbitrary
 * ad-hoc structured messages and pass them on (generally, queue them up on an
 * event queue of some sort) for eventual writing / transmitting to one or more
 * event sinks.
 *
 * To use a logger, simply invoke any method on it, passing it arbitrary
 * arguments, and a message with the method's name and those arguments gets
 * logged. For example, given a logger called `logger`, calling the method
 * `logger.someName(1, 2, "three")` logs the structured message `someName(1, 2,
 * "three")` to whatever source the logger is attached to. The method name --
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
 * `logger.subComponent` is a logger which has `"subComponent"` appended to its
 * tag, and likewise `logger.subComponent.someName("stuff")` will log the event
 * `someName("stuff")` with a tag that includes the logger's original context
 * plus `"subComponent"`.
 *
 * Beyond the arbitrary names used to queue up events and create subloggers,
 * there are a few special names that can be used to access metainformation
 * about a logger. These are all documented as properties on this class.
 *
 * **Note:** Under the covers (unsurprisingly) every logger instance is in fact
 * a proxy.
 *
 * @interface
 */
export class IntfRequestLogger {
  // TODO: $meta, $newId, etc.
}
