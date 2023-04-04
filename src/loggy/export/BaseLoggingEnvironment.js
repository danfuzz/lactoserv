// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Converter, ConverterConfig, Moment, StackTrace } from '@this/data-values';
import { Methods, MustBe } from '@this/typey';

import { LogPayload } from '#x/LogPayload';
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
  /** @type {Converter} Data converter to use for encoding payload arguments. */
  #dataConverter = new Converter(ConverterConfig.makeLoggingInstance());

  // Note: The default constructor is fine here.

  /**
   * Logs a {@link #LogPayload}, which is constructed from the arguments passed
   * to this method along with a timestamp and stack trace as implemented by the
   * concrete subclass. The so-constructed payload is then emitted, as if by
   * {@link #logPayload}, see which for further details.
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The log tag.
   * @param {string} type The event type.
   * @param {...*} args Event arguments.
   */
  log(omitCount, tag, type, ...args) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    // `+1` to omit the frame for this method.
    const payload = this.#makePayloadUnchecked(omitCount + 1, tag, type, ...args);
    this._impl_logPayload(payload);
  }

  /**
   * Logs a pre-constructed {@link #LogPayload}. Typically, this ends up
   * emitting a {@link #LinkedEvent} from an event source of some sort (which
   * is, for example, what the standard concrete subclass of this class does),
   * but it is not _necessarily_ what happens (that is, it depends on the
   * concrete subclass).
   *
   * @param {LogPayload} payload What to log.
   */
  logPayload(payload) {
    MustBe.instanceOf(payload, LogPayload);
    this._impl_logPayload(payload);
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
   * Makes a `LogPayload` instance, processing arguments as needed for the
   * ultimate destination.
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
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    // `+1` to omit the frame for this method.
    return this.#makePayloadUnchecked(omitCount + 1, tag, type, ...args);
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
   * Gets a moment representing "now.""
   *
   * @returns {Moment} The moment "now."
   */
  now() {
    const result = MustBe.instanceOf(this._impl_now(), Moment);
    const atSecs = result.atSecs;

    if (atSecs < BaseLoggingEnvironment.MIN_REASONABLE_NOW_SEC) {
      throw new Error('Too small to be a reasonable "now."');
    } else if (atSecs > BaseLoggingEnvironment.MAX_REASONABLE_NOW_SEC) {
      throw new Error('Too large to be a reasonable "now."');
    }

    return result;
  }

  /**
   * Outputs the given payload to its ultimate destination. For example, the
   * standard concrete implementation of this method emits a {@link
   * #LinkedEvent} with `payload` as the payload.
   *
   * @abstract
   * @param {LogPayload} payload What to log.
   */
  _impl_logPayload(payload) {
    Methods.abstract(payload);
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
   * Gets a {@link Moment} representing "now." This is called by {@link #now},
   * which sanity-checks the value before returning it.
   *
   * @abstract
   * @returns {Moment} The moment "now."
   */
  _impl_now() {
    Methods.abstract();
  }

  /**
   * Like {@link #makePayload}, except without any argument checking, so that
   * intra-class callers don't have to have redundant checks.
   *
   * @param {number} omitCount The number of caller frames to omit from the
   *   stack trace.
   * @param {LogTag} tag The payload tag.
   * @param {string} type Event type.
   * @param {...*} args Event arguments.
   * @returns {LogPayload} The constructed payload.
   */
  #makePayloadUnchecked(omitCount, tag, type, ...args) {
    const now       = this.now();
    const fixedArgs = this.#dataConverter.encode(args);

    // `+1` to omit the frame for this method.
    const trace = this.makeStackTrace(omitCount + 1);

    return new LogPayload(trace, now, tag, type, ...fixedArgs);
  }


  //
  // Static members
  //

  /** @type {number} Lower bound for "reasonable" timestamps. */
  static #MIN_REASONABLE_NOW_SEC = 900_000_000; // The late 1990s.

  /** @type {number} Upper bound for "reasonable" timestamps. */
  static #MAX_REASONABLE_NOW_SEC = 4_200_000_000; // The early 22nd century.
}
