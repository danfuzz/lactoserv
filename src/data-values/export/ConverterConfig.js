// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf, MustBe } from '@this/typey';

import { BaseConfig } from '#x/BaseConfig';
import { BaseConverter } from '#x/BaseConverter';
import { Ref } from '#x/Ref';
import { Sexp } from '#x/Sexp';
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
 * * `name` -- Replace the value with its name (or `<anonymous>`) and a bit of
 *   decoration indicating its type (function, class, instance, or plain
 *   object).
 * * `omit` -- Omit the value in question. If the value would be returned
 *   directly, instead `undefined` is returned. If the value would be incluided
 *   in a plain object or array, the key it would be bound to is omitted
 *   (possibly causing an array to be sparse).
 * * `unhandled` -- Treat the value conversion as "unhandled." The return value
 *   from `encode()` will in fact be {@link BaseConverter#UNHANDLED}.
 * * `wrap` -- Wrap the value in question inside an instance of {@link Ref}, a
 *   class that is defined in this module.
 *
 * In cases where these values are allowed, a function is also sometimes
 * allowed, which can be called on to provide a replacement value.
 */
export class ConverterConfig extends BaseConfig {
  // @defaultConstructor

  /**
   * Classes whose instances are treated as data values. This value is always
   * frozen; if passed in upon construction as an unfrozen value, then a frozen
   * clone is used.
   *
   * @param {Array<function(new:*)>} [value] Proposed configuration value.
   *   Default `[Ref, Sexp]`.
   * @returns {Array<function(new:*)>} Accepted configuration value.
   */
  _config_dataClasses(value = Object.freeze([Ref, Sexp])) {
    MustBe.arrayOf(value, AskIf.constructorFunction);

    return Object.isFrozen(value) ? value : Object.freeze([...value]);
  }

  /**
   * Are converted data values to be frozen? If `false`, then no frozen data
   * values will be returned, even if they required no other conversion during
   * encoding.
   *
   * @param {boolean} [value] Proposed configuration value. Default `true`.
   * @returns {boolean} Accepted configuration value.
   */
  _config_freeze(value = true) {
    return MustBe.boolean(value);
  }

  /**
   * Action to take when asked to encode a function. See class header comment
   * for details.
   *
   * @param {string|(function(*): *)} [value] Proposed configuration value.
   *   Default `'wrap'`.
   * @returns {string|(function(*): *)} Accepted configuration value.
   */
  _config_functionAction(value = 'wrap') {
    return ConverterConfig.#checkAction(value);
  }

  /**
   * Should instance-defined `ENCODE()` methods be honored?
   *
   * @param {boolean} [value] Proposed configuration value. Default `true`.
   * @returns {boolean} Accepted configuration value.
   */
  _config_honorEncodeMethod(value = true) {
    return MustBe.boolean(value);
  }

  /**
   * Action to take when asked to encode an instance (object with a class) which
   * is not otherwise covered by other configuration options.
   *
   * @param {string|(function(*): *)} [value] Proposed configuration value.
   *   Default `'wrap'`.
   * @returns {string|(function(*): *)} Accepted configuration value.
   */
  _config_instanceAction(value = 'wrap') {
    return ConverterConfig.#checkAction(value);
  }

  /**
   * Converter to handle any special cases that take precedence over other
   * configuration options, or `null` if there are no special cases.
   *
   * @param {?BaseConverter} [value] Proposed configuration value. Default
   *   {@link SpecialConverters#STANDARD}.
   * @returns {?BaseConverter} Accepted configuration value.
   */
  _config_specialCases(value = SpecialConverters.STANDARD) {
    return (value === null)
      ? null
      : MustBe.instanceOf(value, BaseConverter);
  }

  /**
   * Action to take when encountering a symbol-keyed object or array property.
   * Allowed to be either `error` or `omit`.
   *
   * @param {string} [value] Proposed configuration value. Default `'omit'`.
   * @returns {string} Accepted configuration value.
   */
  _config_symbolKeyAction(value = 'omit') {
    return ConverterConfig.#checkSymbolKeyAction(value);
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
    for (const cls of this.dataClasses) {
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
   * @param {?object} [options] Extra configuration options, or `null` for
   *   nothing extra.
   * @returns {ConverterConfig} The default / baseline logging configuration.
   */
  static makeLoggingInstance(options = null) {
    options ??= {};

    return new this({
      functionAction: 'name',
      instanceAction: 'name',
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
