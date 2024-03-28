// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf, MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Ref } from '#x/Ref';
import { SpecialConverters } from '#x/SpecialConverters';
import { Struct } from '#x/Struct';


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
 * * `name` -- Replace the value with the `.name` property of the value if it is
 *    a non-empty string, or with `<no-name>` if it is unbound or anything else.
 *    This is most useful for functions (both regular and constructors).
 * * `omit` -- Omit the value in question. If the value would be returned
 *   directly, instead `undefined` is returned. If the value would be
 *   incluided in a plain object or array, the key it would be bound to is
 *   omitted (possibly causing an array to be sparse).
 * * `unhandled` -- Treat the value conversion as "unhandled." The return value
 *   from `encode()` will in fact be {@link BaseConverter#UNHANDLED}.
 * * `wrap` -- Wrap the value in question inside an instance of {@link Ref}, a
 *   class that is defined in this module.
 *
 * In cases where these values are allowed, a function is also sometimes
 * allowed, which can be called on to provide a replacement value.
 */
export class ConverterConfig {
  /**
   * Classes whose instances are treated as data
   * values.
   *
   * @type {Array<function(new:*)>}
   */
  #dataClasses;

  /**
   * Are converted data values to be frozen?
   *
   * @type {boolean}
   */
  #freeze;

  /**
   * Action to take when asked to encode a
   * function.
   *
   * @type {string|(function(*): *)}
   */
  #functionAction;

  /**
   * Should instance-defined `ENCODE()` methods be honored?
   *
   * @type {boolean}
   */
  #honorEncodeMethod;

  /**
   * Action to take when asked to encode an
   * instance (object with a class) which is not otherwise covered by other
   * configuration options.
   *
   * @type {string|(function(*): *)}
   */
  #instanceAction;

  /**
   * {?BaseConverter} Converter to handle any special cases that take precedence
   * over other configuration options.
   */
  #specialCases;

  /**
   * Action to take when encountering a symbol-keyed object or
   * array property. Allowed to be either `error` or `omit`.
   *
   * @type {string}
   */
  #symbolKeyAction;

  /**
   * Constructs an instance. See the accessors on this class for details on the
   * options, including defaults.
   *
   * @param {?object} [options] Configuration options, or `null` to use
   *   the default configuration.
   */
  constructor(options = null) {
    options = (options === null) ? {} : MustBe.plainObject(options);

    const {
      dataClasses       = [Ref, Struct],
      freeze            = true,
      functionAction    = 'wrap',
      honorEncodeMethod = true,
      instanceAction    = 'wrap',
      specialCases      = SpecialConverters.STANDARD,
      symbolKeyAction   = 'omit'
    } = options;

    this.#dataClasses       = Object.freeze(
      MustBe.arrayOf(dataClasses, AskIf.constructorFunction));
    this.#freeze            = MustBe.boolean(freeze);
    this.#functionAction    = ConverterConfig.#checkAction(functionAction);
    this.#honorEncodeMethod = MustBe.boolean(honorEncodeMethod);
    this.#instanceAction    = ConverterConfig.#checkAction(instanceAction);
    this.#specialCases      = (specialCases === null)
      ? null
      : MustBe.instanceOf(specialCases, BaseConverter);
    this.#symbolKeyAction   =
      ConverterConfig.#checkSymbolKeyAction(symbolKeyAction);
  }

  /**
   * @returns {Array<function(new:*)>} Classes whose instances are treated as
   * data values.
   *
   * Default value if not passed during construction: `[Ref, Struct]`.
   *
   * This value is always frozen; if passed in upon construction as an unfrozen
   * value, then frozen clone is used.
   */
  get dataClasses() {
    return this.#dataClasses;
  }

  /**
   * @returns {boolean} Are converted data values to be frozen? If `false`, then
   * no frozen data values will be returned, even if they required no other
   * conversion during encoding.
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
  get honorEncodeMethod() {
    return this.#honorEncodeMethod;
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
   * Gets the default / baseline configuration for use in a logging context.
   * This configuration errs on the side of `inspect`ing and `name`ing things,
   * and also arranges for stack traces to be parsed.
   *
   * The return value is always a fresh instance which is safe for the caller to
   * modify. (It does not alter future results from this method.)
   *
   * @param {?object} [options] Extra configuration options, or `null`
   *   for nothing extra.
   * @returns {ConverterConfig} The default / baseline logging configuration.
   */
  static makeLoggingInstance(options = null) {
    options ??= {};

    return new this({
      functionAction: 'name',
      instanceAction: 'inspect',
      specialCases:   SpecialConverters.STANDARD_FOR_LOGGING,
      ...options
    });
  }

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
        case 'name':
        case 'omit':
        case 'unhandled':
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
        case 'error':
        case 'omit': {
          return value;
        }
      }
    }

    throw new Error(`Invalid action: ${value}`);
  }
}
