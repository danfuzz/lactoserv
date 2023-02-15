// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Converter, ConverterConfig, StackTrace } from '@this/data-values';
import { Methods, MustBe } from '@this/typey';

import { LogRecord } from '#x/LogRecord';
import { LogTag } from '#x/LogTag';


/**
 * Abstract class representing a provider of a "logging environment." This class
 * exists so that the rest of the logging system doesn't have to _directly_
 * depend on system-specific services, nor tacitly refer to effectively-global
 * variables (which are awkward to stub/mock out for testing).
 *
 * Subclasses are expected to override the `_impl_*` methods, while leaving the
 * other (unmarked) methods alone. The latter provide type safety and other
 * sanity checks in both directions.
 */
export class BaseLoggingEnvironment {
  /** @type {Converter} Data converter to use for encoding record arguments. */
  #dataConverter = new Converter(ConverterConfig.makeLoggingInstance());

  // Note: The default constructor is fine here.

  /**
   * Logs a {@link #LogRecord}, which is either passed directly or constructed
   * from the arguments passed to this method. Typically, this ends up emitting
   * a {@link #LogEvent} from an event source of some sort (which is, for
   * example, what the standard concrete subclass of this class does), but it is
   * not _necessarily_ what happens (that is, it depends on the concrete
   * subclass).
   *
   * If _not_ called with a {@link #LogRecord}, this method fills in the
   * timestamp and stack trace as implemented by the concrete subclass.
   *
   * @param {LogRecord|LogTag} recordOrTag The complete log record or the tag.
   * @param {?string} [type = null] Event type, if given a tag for
   *   `recordOrTag`; must be `null` when given a full {@link LogRecord}.
   * @param {...*} args Event arguments, if given a tag for `recordOrTag`; must
   *   be empty when given a full {@link LogRecord}.
   */
  log(recordOrTag, type = null, ...args) {
    if (recordOrTag instanceof LogRecord) {
      MustBe.null(type);
      if (args.length !== 0) {
        throw new Error('Cannot pass extra `args` with record instance.');
      }
      this._impl_log(recordOrTag);
    } else if (recordOrTag instanceof LogTag) {
      MustBe.string(type);
      const record = this.#makeRecordUnchecked(1, recordOrTag, type, ...args);
      this._impl_log(record);
    } else {
      throw new Error('Invalid value for `recordOrTag`.');
    }
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
    return MustBe.string(this._impl_makeId(), /^.{1,20}$/);
  }

  /**
   * Makes a `LogRecord` instance, processing arguments as needed for the
   * ultimate destination.
   *
   * For example and in particular, non-JSON-encodable values may want to be
   * tweaked. The standard concrete implementation of this method takes care of
   * that, but there is more than one reasonable way to accomplish this. Hence
   * this "hook."
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The record tag.
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   * @returns {LogRecord} The constructed record.
   */
  makeRecord(omitCount, tag, type, ...args) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    const nowSec    = this.nowSec();
    const fixedArgs = this.#dataConverter.encode(args);

    // `+1` to omit the frame for this method.
    return this.#makeRecordUnchecked(omitCount + 1, tag, type, ...args);
  }

  /**
   * Makes a {@link StackTrace} representing the current call site (that is, the
   * caller of this method), less the given number of additional inner frames.
   * If this instance is configured to not include call site stack traces, then
   * this method returns `null`.
   *
   * @param {number} [omitCount = 0] The number of caller frames to omit.
   * @returns {?StackTrace} An appropriately-constructed instance.
   */
  makeStackTrace(omitCount = 0) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });

    // `+1` to omit the frame for this method.
    const result = this._impl_makeStackTrace(omitCount + 1);

    return (result === null) ? null : MustBe.instanceOf(result, StackTrace);
  }

  /**
   * Gets a timestamp representing "now," represented as seconds since the
   * Unix Epoch, with microsecond-or-better precision.
   *
   * @abstract
   * @returns {number} "Now" in seconds.
   */
  nowSec() {
    const result = MustBe.number(this._impl_nowSec());

    if (result < BaseLoggingEnvironment.MIN_REASONABLE_NOW_SEC) {
      throw new Error('Too small to be a reasonable timestamp.');
    } else if (result > BaseLoggingEnvironment.MAX_REASONABLE_NOW_SEC) {
      throw new Error('Too large to be a reasonable timestamp.');
    }

    return result;
  }

  /**
   * Outputs the given record to its ultimate destination. For example, the
   * standard concrete implementation of this method emits a {@link #LogEvent}
   * with `record` as the payload.
   *
   * @abstract
   * @param {LogRecord} record The record to log.
   */
  _impl_log(record) {
    Methods.abstract(record);
  }

  /**
   * Makes a new ID, suitable for returning through {@link #makeId}.
   *
   * @abstract
   * @returns {string} The new ID.
   */
  _impl_makeId() {
    Methods.abstract();
  }

  /**
   * Makes a {@link StackTrace} or returns `null`, as appropriate for returning
   * through {@link #makeStackTrace}.
   *
   * @abstract
   * @param {number} omitCount The number of caller frames to omit.
   * @returns {?StackTrace} An appropriately-constructed instance.
   */
  _impl_makeStackTrace(omitCount) {
    Methods.abstract(omitCount);
  }

  /**
   * Gets a timestamp representing "now," represented as seconds since the
   * Unix Epoch, with microsecond-or-better precision. This is called by
   * {@link #nowSec}, which sanity-checks the value before returning it.
   *
   * @abstract
   * @returns {number} "Now" in seconds.
   */
  _impl_nowSec() {
    Methods.abstract();
  }

  /**
   * Like {@link #makeRecord}, except without any argument checking, so that
   * intra-class callers don't have to have redundant checks.
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The record tag.
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   * @returns {LogRecord} The constructed record.
   */
  #makeRecordUnchecked(omitCount, tag, type, ...args) {
    const nowSec    = this.nowSec();
    const fixedArgs = this.#dataConverter.encode(args);

    // `+1` to omit the frame for this method.
    const trace = this.makeStackTrace(omitCount + 1);

    return new LogRecord(nowSec, tag, type, fixedArgs, trace);
  }


  //
  // Static members
  //

  /** @type {number} Lower bound for "reasonable" timestamps. */
  static #MIN_REASONABLE_NOW_SEC = 900_000_000; // The late 1990s.

  /** @type {number} Upper bound for "reasonable" timestamps. */
  static #MAX_REASONABLE_NOW_SEC = 4_200_000_000; // The early 22nd century.
}
