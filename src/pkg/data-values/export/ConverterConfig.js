// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { AskIf, MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Construct } from '#x/Construct';
import { NonData } from '#x/NonData';
import { SpecialConverters } from '#x/SpecialConverters';

/**
 * Configuration for data value conversion. This class contains all configurable
 * parameters and methods to use them.
 *
 * The configuration options include a few common enum-like strings as
 * possibilities for how to treat a non-data value:
 *
 * * `asObject` -- Process the value as if it were a plain object.
 * * `error` -- Treat the case as an error.
 * * `inspect` -- Replace the value with the results of a call to
 *   `util.inspect()` on the value.
 * * `omit` -- Omit the value in question. If the value would be returned
 *   directly, instead `undefined` is returned. If the value would be
 *   incluided in a plain object or array, the key it would be bound to is
 *   omitted (possibly causing an array to be sparse).
 * * `wrap` -- Wrap the value in question with an instance of {@link NonData},
 *   a class that is defined in this module.
 *
 * In cases where these values are allowed, a function is also sometimes
 * allowed, which can be called on to provide a replacement value.
 */
export class ConverterConfig {
  /**
   * @type {(function(new:*))[]} Classes whose instances are treated as data
   * values.
   */
  #dataClasses;

  /** @type {boolean} Are converted data values to be frozen? */
  #freeze;

  /**
   * @type {string|(function(*): *)} Action to take when asked to encode a
   * function.
   */
  #functionAction;

  /** @type {boolean} Should instance-defined `ENCODE()` methods be honored? */
  #honorToData;

  /**
   * @type {string|(function(*): *)} Action to take when asked to encode an
   * instance (object with a class) which is not otherwise covered by other
   * configuration options.
   */
  #instanceAction;

  /**
   * {?BaseConverter} Converter to handle any special cases that take precedence
   * over other configuration options.
   */
  #specialCases;

  /**
   * @type {string} Action to take when encountering a symbol-keyed object or
   * array property. Allowed to be either `error` or `omit`.
   */
  #symbolKeyAction;

  /**
   * Constructs an instance. See the accessors on this class for details on the
   * options, including defaults.
   *
   * @param {?object} [options = null] Configuration options, or `null` to use
   *   the default configuration.
   */
  constructor(options = null) {
    options = (options === null) ? {} : MustBe.plainObject(options);

    const {
      dataClasses     = [Construct, NonData],
      freeze          = true,
      functionAction  = 'wrap',
      honorToData     = true,
      instanceAction  = 'wrap',
      specialCases    = SpecialConverters.STANDARD,
      symbolKeyAction = 'omit'
    } = options;

    this.#dataClasses     = Object.freeze(
      MustBe.arrayOf(dataClasses, AskIf.constructorFunction));
    this.#freeze          = MustBe.boolean(freeze);
    this.#functionAction  = ConverterConfig.#checkAction(functionAction);
    this.#honorToData     = MustBe.boolean(honorToData);
    this.#instanceAction  = ConverterConfig.#checkAction(instanceAction);
    this.#specialCases    = (specialCases === null)
      ? null
      : MustBe.instanceOf(specialCases, BaseConverter);
    this.#symbolKeyAction =
      ConverterConfig.#checkSymbolKeyAction(symbolKeyAction);
  }

  /**
   * @returns {(function(new:*))[]} Classes whose instances are treated as data
   * values.
   *
   * Default value if not passed during construction: `[Construct, NonData]`.
   *
   * This value is always frozen; if passed in upon construction as an unfrozen
   * value, then frozen clone is used.
   */
  get dataClasses() {
    return this.#dataClasses;
  }

  /**
   * @returns {boolean} Are converted data values to be frozen?
   *
   * Default value if not passed during construction: `true`
   */
  get freeze() {
    return this.#freeze;
  }

  /**
   * @returns {string|(function(*): *)} Action to take when asked to encode a
   * function.
   *
   * Default value if not passed during construction: `wrap`
   */
  get functionAction() {
    return this.#functionAction;
  }

  /**
   * @returns {boolean} Should instance-defined `ENCODE()` methods be honored?
   *
   * Default value if not passed during construction: `true`
   */
  get honorToData() {
    return this.#honorToData;
  }

  /**
   * @returns {string|(function(*): *)} Action to take when asked to encode an
   * instance (object with a class) which is not otherwise covered by other
   * configuration options.
   *
   * Default value if not passed during construction: `wrap`
   */
  get instanceAction() {
    return this.#instanceAction;
  }

  /**
   * @returns {?BaseConverter} Converter to handle any special cases that take
   * precedence over other configuration options, or `null` if there are no
   * special cases.
   *
   * Default value if not passed during construction:
   * {@link SpecialConverters#STANDARD}.
   */
  get specialCases() {
    return this.#specialCases;
  }

  /**
   * @returns {string} Action to take when encountering a symbol-keyed object or
   * array property. Allowed to be either `error` or `omit`.
   *
   * Default value if not passed during construction: `omit`
   */
  get symbolKeyAction() {
    return this.#symbolKeyAction;
  }

  /**
   * Indicates whether the given value is considered a "data instance" per the
   * configured {@link #dataClasses}.
   *
   * @param {*} value Value to check.
   * @returns {boolean} `true` iff it is an instance of one of the configured
   *   data classes.
   */
  isDataInstance(value) {
    for (const cls of this.#dataClasses) {
      if (value instanceof cls) {
        return true;
      }
    }

    return false;
  }


  //
  // Static members
  //

  /**
   * Checks an "action" binding value.
   *
   * @param {*} value Value to check.
   * @returns {*} `value` if it is okay as an "action."
   * @throws {Error} Thrown if not valid.
   */
  static #checkAction(value) {
    if (typeof value === 'string') {
      switch (value) {
        case 'asObject':
        case 'error':
        case 'inspect':
        case 'omit':
        case 'wrap': {
          return value;
        }
      }
    } else if (AskIf.callableFunction(value)) {
      return value;
    }

    throw new Error(`Invalid action: ${value}`);
  }

  /**
   * Checks a `symbolKeyAction` binding value.
   *
   * @param {*} value Value to check.
   * @returns {*} `value` if it is okay as a `symbolKeyAction`.
   * @throws {Error} Thrown if not valid.
   */
  static #checkSymbolKeyAction(value) {
    if (typeof value === 'string') {
      switch (value) {
        case 'omit':
        case 'wrap': {
          return value;
        }
      }
    }

    throw new Error(`Invalid action: ${value}`);
  }
}
