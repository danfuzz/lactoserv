// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { StandardConverters } from '#p/StandardConverters';


/**
 * Class that knows how to dispatch to special converters, and also where to go
 * to get a standard instance that handles built-in JavaScript classes.
 */
export class SpecialConverters extends BaseConverter {
  /**
   * @type {Map<function(new:object, ...*), BaseConverter>} Map from each
   * specially-handled class to the converter to use on that class.
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
   * @param {BaseConverter} converter Converter to use on instances of `cls`.
   */
  add(cls, converter) {
    MustBe.function(cls);
    MustBe.instanceOf(converter, BaseConverter);

    if (this.#converters.has(cls)) {
      throw new Error('Class already added.');
    }

    this.#converters.set(cls, converter);
  }

  /**
   * Adds a converter to associate with all the standard `Error` classes /
   * subclasses.
   *
   * @param {BaseConverter} converter Converter to use on instances of `cls`.
   */
  addForErrors(converter) {
    for (const e of [Error, EvalError, RangeError, ReferenceError, SyntaxError,
      TypeError, URIError]) {
      this.add(e, converter);
    }
  }

  /** @override */
  decode(data_unused) {
    throw new Error('TODO');
  }

  /** @override */
  encode(value) {
    const cls = value?.constructor;
    if (!cls) {
      return BaseConverter.UNHANDLED;
    }

    const converter = this.#converters.get(cls);
    if (!converter) {
      return BaseConverter.UNHANDLED;
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

  /** @type {?SpecialConverters} Standard instance, if known. */
  static #STANDARD = null;

  /**
   * @returns {SpecialConverters} Standard instance which covers many built-in
   * JavaScript classes.
   */
  static get STANDARD() {
    this.#STANDARD ??= StandardConverters.STANDARD;
    return this.#STANDARD;
  }
}
