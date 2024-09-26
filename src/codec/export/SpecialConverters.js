// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseCodec } from '#x/BaseCodec';
import { StandardConverters } from '#p/StandardConverters';


/**
 * Class that knows how to dispatch to special converters, and also where to go
 * to get a standard instance that handles built-in JavaScript classes.
 */
export class SpecialConverters extends BaseCodec {
  /**
   * Map from each specially-handled class to the converter to use on that
   * class.
   *
   * @type {Map<function(new:object, ...*), BaseCodec>}
   */
  #converters = new Map();

  /**
   * Constructs an instance. It is initially empty.
   */
  constructor() {
    super();

    // Nothing else to do here.
  }

  /**
   * Adds a converter for _direct_ instances of a given class (not for any
   * subclasses).
   *
   * @param {function(new:object, ...*)} cls Class whose instances are to be
   *   converted.
   * @param {BaseCodec} converter Converter to use on instances of `cls`.
   */
  add(cls, converter) {
    MustBe.function(cls);
    MustBe.instanceOf(converter, BaseCodec);

    if (this.#converters.has(cls)) {
      throw new Error('Class already added.');
    }

    this.#converters.set(cls, converter);
  }

  /**
   * Adds all of the converters from another instance as defaults to this one,
   * that is, it adds all the ones not already covered by a binding in this
   * instance.
   *
   * @param {SpecialConverters} defaults The instance to use for defaults.
   */
  addDefaults(defaults) {
    MustBe.instanceOf(defaults, SpecialConverters);

    for (const [cls, converter] of defaults.#converters) {
      if (!this.#converters.has(cls)) {
        this.#converters.set(cls, converter);
      }
    }
  }

  /**
   * Adds a converter to associate with all the standard `Error` classes /
   * subclasses.
   *
   * @param {BaseCodec} converter Converter to use on instances of `cls`.
   */
  addForErrors(converter) {
    MustBe.instanceOf(converter, BaseCodec);

    for (const e of [DOMException, Error, EvalError, RangeError, ReferenceError,
      SyntaxError, TypeError, URIError]) {
      this.add(e, converter);
    }
  }

  /** @override */
  decode(data) {
    throw BaseCodec.decodingUnimplemented(data);
  }

  /** @override */
  encode(value) {
    const cls = value?.constructor;
    if (!cls) {
      return BaseCodec.UNHANDLED;
    }

    const converter = this.#converters.get(cls);
    if (!converter) {
      return BaseCodec.UNHANDLED;
    }

    return converter.encode(value);
  }

  /**
   * Freezes this instance.
   */
  freeze() {
    Object.freeze(this.#converters);
    Object.freeze(this);
  }


  //
  // Static members
  //

  /**
   * Standard instance, if known.
   *
   * @type {?SpecialConverters}
   */
  static #STANDARD = null;

  /**
   * Standard logging instance, if known.
   *
   * @type {?SpecialConverters}
   */
  static #STANDARD_FOR_LOGGING = null;

  /**
   * @returns {SpecialConverters} Standard instance which covers many built-in
   * JavaScript classes.
   */
  static get STANDARD() {
    this.#STANDARD ??= StandardConverters.STANDARD;
    return this.#STANDARD;
  }

  /**
   * @returns {SpecialConverters} Standard instance intended for use in logging,
   * which covers many built-in JavaScript classes.
   */
  static get STANDARD_FOR_LOGGING() {
    this.#STANDARD_FOR_LOGGING ??= StandardConverters.STANDARD_FOR_LOGGING;
    return this.#STANDARD_FOR_LOGGING;
  }
}
