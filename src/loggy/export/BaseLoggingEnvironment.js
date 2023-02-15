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
   * Emits an event from whatever event source this instance is connected to.
   * This method accepts _either_ an instance of {@link LogRecord} _or_ the
   * arguments to construct an instance (except for the stack and time, which
   * are filled in by this method).
   *
   * @param {LogRecord|LogTag} recordOrTag The complete log record or the tag.
   * @param {?string} [type = null] Event type, if given a tag for
   *   `recordOrTag`; must be `null` when given a full {@link LogRecord}.
   * @param {...*} args Event arguments, if given a tag for `recordOrTag`; must
   *   be empty when given a full {@link LogRecord}.
   */
  emit(recordOrTag, type = null, ...args) {
    if (recordOrTag instanceof LogRecord) {
      MustBe.null(type);
      if (args.length !== 0) {
        throw new Error('Cannot pass extra `args` with record instance.');
      }
      this._impl_emit(recordOrTag);
    } else if (recordOrTag instanceof LogTag) {
      const record = this.makeRecord(recordOrTag, type, ...args);
      this._impl_emit(record);
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
   * @param {LogTag} tag The record tag.
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   * @returns {LogRecord} The constructed record.
   */
  makeRecord(tag, type, ...args) {
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    const nowSec    = this.nowSec();
    const fixedArgs = this.#dataConverter.encode(args);
    const trace     = this.makeStackTrace(1);

    return new LogRecord(nowSec, tag, type, fixedArgs, trace);
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
   * Emits an event with the given payload from whatever event source this
   * instance is connected to.
   *
   * @abstract
   * @param {LogRecord} record The record to log.
   */
  _impl_emit(record) {
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


  //
  // Static members
  //

  /** @type {number} Lower bound for "reasonable" timestamps. */
  static #MIN_REASONABLE_NOW_SEC = 900_000_000; // The late 1990s.

  /** @type {number} Upper bound for "reasonable" timestamps. */
  static #MAX_REASONABLE_NOW_SEC = 4_200_000_000; // The early 22nd century.
}
