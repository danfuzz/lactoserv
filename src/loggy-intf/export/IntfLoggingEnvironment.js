// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment, StackTrace } from '@this/data-values';
import { LogPayload, LogTag } from '@this/loggy-intf';
import { Methods } from '@this/typey';


/**
 * Interface representing a "logging environment." This interface exists so that
 * the rest of the logging interface doesn't have to _directly_ depend on
 * system-specific services, nor tacitly refer to effectively-global variables
 * (which are awkward to stub/mock out for testing).
 *
 * Note that there is an abstract base class `BaseLoggingEnvironment`, which
 * provides a partial implementation with the usual-named `_impl_*` methods as
 * holes to fill out.
 *
 * @interface
 */
export class IntfLoggingEnvironment {
  /**
   * Logs a {@link #LogPayload}, which is constructed from the arguments passed
   * to this method along with a timestamp and stack trace as implemented by the
   * concrete implementation, as if by {@link #makePayload}. The so-constructed
   * payload is then emitted, as if by {@link #logPayload}.
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The log tag.
   * @param {string} type The event type.
   * @param {...*} args Event arguments.
   */
  log(omitCount, tag, type, ...args) {
    Methods.abstract(omitCount, tag, type, args);
  }

  /**
   * Logs a pre-constructed {@link #LogPayload}. Typically, this ends up
   * emitting an event (e.g. a `LinkedEvent`) from an event source of some sort
   * (which is, for example, what the standard concrete implementation of this
   * interface does), but it is not _necessarily_ what happens (that is, it
   * depends on the implementation).
   *
   * @param {LogPayload} payload What to log.
   */
  logPayload(payload) {
    Methods.abstract(payload);
  }

  /**
   * Makes an ID string suitable for use as a log tag or other context-ish
   * thing. ID strings are meant to be non-empty, relatively short (20
   * chararacters or less) and, while not absolutely unique, unique _enough_ to
   * disambiguate what's happening in the logs given other context.
   *
   * @returns {string} A short-ish unique-ish ID string.
   */
  makeId() {
    return Methods.abstract();
  }

  /**
   * Makes a {@link #LogPayload} instance, processing arguments as needed for
   * the ultimate destination.
   *
   * For example and in particular, non-JSON-encodable values may want to be
   * tweaked. The standard concrete implementation of this method takes care of
   * that, but there is more than one reasonable way to accomplish this. Hence
   * this "hook."
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The payload tag.
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   * @returns {LogPayload} The constructed payload.
   */
  makePayload(omitCount, tag, type, ...args) {
    return Methods.abstract(omitCount, tag, type, args);
  }

  /**
   * Makes a {@link StackTrace} representing the current call site (that is, the
   * caller of this method), less the given number of additional inner frames.
   * If this instance is configured to not include call site stack traces, then
   * this method returns `null`.
   *
   * @param {number} [omitCount] The number of caller frames to omit. Defaults
   *   to `0`.
   * @returns {?StackTrace} An appropriately-constructed instance.
   */
  makeStackTrace(omitCount = 0) {
    return Methods.abstract(omitCount);
  }

  /**
   * Gets a moment representing "now."
   *
   * @returns {Moment} The moment "now."
   */
  now() {
    return Methods.abstract();
  }
}
