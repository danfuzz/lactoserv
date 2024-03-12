// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { LinkedEvent } from '@this/async';
import { Converter, ConverterConfig, Moment, StackTrace }
  from '@this/data-values';
import { IntfLoggingEnvironment, LogPayload, LogTag } from '@this/loggy-intf';
import { Methods, MustBe } from '@this/typey';


/**
 * Abstract class which implements {@link IntfLoggingEnvironment}, leaving holes
 * for concrete subclasses to fill in.
 *
 * Subclasses are expected to override the `_impl_*` methods, while leaving the
 * other (unmarked) methods alone. The latter provide type safety and other
 * sanity checks in both directions.
 *
 * @implements {IntfLoggingEnvironment}
 */
export class BaseLoggingEnvironment extends IntfLoggingEnvironment {
  /** @type {Converter} Data converter to use for encoding payload arguments. */
  #dataConverter = new Converter(ConverterConfig.makeLoggingInstance());

  // Note: The default constructor is fine here.

  /** @override */
  log(omitCount, tag, type, ...args) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    // `+1` to omit the frame for this method.
    const payload = this.#makePayloadUnchecked(omitCount + 1, tag, type, ...args);
    this._impl_logPayload(payload);
  }

  /** @override */
  logPayload(payload) {
    MustBe.instanceOf(payload, LogPayload);
    this._impl_logPayload(payload);
  }

  /** @override */
  makeId() {
    return MustBe.string(this._impl_makeId(), /^.{1,20}$/);
  }

  /** @override */
  makePayload(omitCount, tag, type, ...args) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });
    MustBe.instanceOf(tag, LogTag);
    MustBe.string(type);

    // `+1` to omit the frame for this method.
    return this.#makePayloadUnchecked(omitCount + 1, tag, type, ...args);
  }

  /** @override */
  makeStackTrace(omitCount = 0) {
    MustBe.number(omitCount, { minInclusive: 0, safeInteger: true });

    // `+1` to omit the frame for this method.
    const result = this._impl_makeStackTrace(omitCount + 1);

    return (result === null) ? null : MustBe.instanceOf(result, StackTrace);
  }

  /** @override */
  now() {
    const result = MustBe.instanceOf(this._impl_now(), Moment);
    const atSec = result.atSec;

    if (atSec < BaseLoggingEnvironment.MIN_REASONABLE_NOW_SEC) {
      throw new Error('Too small to be a reasonable "now."');
    } else if (atSec > BaseLoggingEnvironment.MAX_REASONABLE_NOW_SEC) {
      throw new Error('Too large to be a reasonable "now."');
    }

    return result;
  }

  /**
   * Outputs the given payload to its ultimate destination. For example, the
   * standard concrete implementation of this method emits a {@link LinkedEvent}
   * with `payload` as the payload.
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
