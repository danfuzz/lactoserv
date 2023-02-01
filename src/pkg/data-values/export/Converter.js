// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as util from 'node:util';

import { AskIf, MustBe } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { ConverterConfig } from '#x/ConverterConfig';
import { NonData } from '#x/NonData';

// TODO: Handle self-referential structures.

// TODO: Is there a sane way to know if an array is non-sparse and has no extra
// properties? If so, it might be more efficient to iterate directly over such
// arrays, as opposed to using `Object.entries()` and the like.

/**
 * Converter to and from data values. See the module `README.md` for a bit more
 * detail.
 */
export class Converter {
  /** @type {ConverterConfig} Configuration to use. */
  #config;

  /**
   * Constructs an instance.
   *
   * @param {?ConverterConfig} config Configuration to use, or `null` to use the
   *   default configuration.
   */
  constructor(config = null) {
    this.#config = (config === null)
      ? new ConverterConfig()
      : MustBe.instanceOf(config, ConverterConfig);
  }

  /**
   * Decodes a data value to an arbitrary value.
   *
   * @param {*} data The data value to decode.
   * @returns {*} The decoded form.
   * @throws {Error} Thrown if there is trouble performing the conversion.
   */
  decode(data) {
    // TODO
    if (data !== data) {
      return data;
    }
    throw new Error('TODO');
  }

  /**
   * Encodes an arbitrary value to a data value.
   *
   * @param {*} value The value to encode.
   * @returns {*} The encoded form.
   * @throws {Error} Thrown if there is trouble performing the conversion.
   */
  encode(value) {
    const result = this.#encode0(value);

    return (result === Converter.#OMIT)
      ? undefined
      : result;
  }

  /**
   * Helper for {@link #encode}, which does most of the work and is also the
   * recursive re-entry point for the conversion procedure.
   *
   * @param {*} orig Value to convert.
   * @returns {*} The converted version.
   */
  #encode0(orig) {
    const config = this.#config;

    switch (typeof orig) {
      case 'bigint':
      case 'boolean':
      case 'number':
      case 'string':
      case 'symbol':
      case 'undefined': {
        return orig;
      }

      case 'function': {
        return this.#performReplacement(orig, config.functionAction);
      }

      case 'object': {
        if (orig === null) {
          return null;
        } else if (Array.isArray(orig)) {
          return this.#objectOrArrayToData(orig, true);
        } else if (AskIf.plainObject(orig)) {
          return this.#objectOrArrayToData(orig, false);
        } else if (config.isDataInstance(orig)) {
          const toConvert   = Object.freeze(orig.toConvertibleValue());
          const replacement = this.#encode0(toConvert);
          return (replacement === toConvert)
            ? orig
            : orig.withConvertedValue(replacement);
        }

        if (config.specialCases) {
          const replacement = config.specialCases.encode(orig);
          if (replacement !== BaseConverter.UNHANDLED) {
            return this.#encode0(replacement);
          }
        }

        if (config.honorToData && orig[Converter.#TO_DATA]) {
          const replacement = orig[Converter.#TO_DATA]();
          return this.#encode0(replacement);
        } else {
          return this.#performReplacement(orig, config.instanceAction);
        }
      }
    }

    // JavaScript added a new type after this code was written!
    throw new Error(`Unrecognized \`typeof\` result: ${typeof orig}`);
  }

  /**
   * Helper for {@link #encode0}, which performs conversion of arrays and
   * plain objects.
   *
   * @param {*} orig Value to convert.
   * @param {boolean} isArray Is `orig` an array?
   * @returns {*} The converted version.
   */
  #objectOrArrayToData(orig, isArray) {
    const config = this.#config;

    if (   (config.symbolKeyAction === 'error')
        && (Object.getOwnPropertySymbols(orig).length !== 0)) {
      throw new Error(`Encountered symbol key in ${isArray ? 'array' : 'object'}.`);
    }

    // Note: The `Array()` form is needed in case `orig` is a sparse array with
    // unbound indices at the end.
    const result  = isArray ? Array(orig.length) : {};
    let anyChange = false;

    for (const [key, value] of Object.entries(orig)) {
      const newValue = this.#encode0(value);
      anyChange ||= (value !== newValue);
      if (newValue !== Converter.#OMIT) {
        result[key] = newValue;
      }
    }

    if (config.freeze) {
      return (anyChange || !Object.isFrozen(orig))
        ? Object.freeze(result)
        : orig;
    } else {
      if (Object.getOwnPropertySymbols(orig).length !== 0) {
        // It is a "change" in that the result we return omits symbol-keyed
        // properties.
        anyChange = true;
      }
      return anyChange ? result : orig;
    }
  }

  /**
   * Helper for {@link #encode0}, which performs a replacement action as
   * defined by one of the configured actions.
   *
   * @param {*} orig Value to convert.
   * @param {string|function(*): *} action The action option value to use.
   * @returns {*} The converted version.
   */
  #performReplacement(orig, action) {
    switch (action) {
      case 'error':    throw new Error('Encountered non-data.');
      case 'inspect':  return util.inspect(orig);
      case 'omit':     return Converter.#OMIT;
      case 'asObject': return this.#objectOrArrayToData(orig, false);
      case 'wrap':     return new NonData(orig);
      default: {
        // `|| null` to make the call be a function (not method) call.
        const replacement = (action || null)(orig);
        return this.#encode0(replacement);
      }
    }
  }


  //
  // Static members.
  //

  /**
   * @type {symbol} Converted value which is returned to indicate "omit this."
   */
  static #OMIT = Symbol('Converter.OMIT');

  /** @type {symbol} Value for the exposed {@link #TO_DATA}. */
  static #TO_DATA = Symbol('Converter.TO_DATA');

  /**
   * @type {symbol} Name of method to define, in order to specify custom to-data
   * behavior on an instance.
   */
  static get TO_DATA() {
    return this.#TO_DATA;
  }
}
