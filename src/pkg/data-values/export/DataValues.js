// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as util from 'node:util';

import { AskIf } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { ConverterConfig } from '#x/ConverterConfig';
import { NonData } from '#x/NonData';

// TODO: Rework this as an instantiable class, instead of passing config around
// all over the place.

// TODO: Handle self-referential structures.

// TODO: Is there a sane way to know if an array is non-sparse and has no extra
// properties? If so, it might be more efficient to iterate directly over such
// arrays, as opposed to using `Object.entries()` and the like.

/**
 * Converter utilities for data values. For the purposes of this class, "data
 * values" are a superset of what can be represented in JSON and are intented to
 * be (ultimately) a superset of what JavaScript defines as "serializable"
 * values, though with a bit of a twist. Here is a run-down of what is covered:
 *
 * * `undefined`.
 * * `null`.
 * * booleans.
 * * strings.
 * * symbols.
 * * finite numbers of JavaScript types `number` or `bigint`.
 * * non-finite numbers `+Infinity`, `-Infinity`, and `NaN`.
 * * arrays, without symbol bindings; may be sparse _and_ may have non-index
 *   bindings.
 * * plain objects, without symbol bindings.
 * * objects of class {@link Construct} (which is defined in this module).
 * * objects of class {@link NonData} (which is defined in this module). This is
 *   effectively an "escape hatch" to allow arbitrary objects to pass through a
 *   data value conversion without being touched.
 *
 * The `Construct` class is particularly of note. It is the key class used to
 * enable general representation of instances as data. On the way into a data
 * value form, a supported instance gets "deconstructed" into a `Construct`
 * instance, after which it may be serialized as apporpriate for the context.
 * Then later, a (presumably recently) unserialized data value can get processed
 * in a context that understands some set of `Construct`-able types, and proceed
 * to reconstitute new objects that are (sufficiently) equivalent to the
 * originals. The "twist" mentioned above about serializable values is that,
 * while the classes designated by JavaScript to be serializable mostly don't
 * appear in the list of covered data values above, many (and ultimately, one
 * hopes, all) are covered by special case conversion to `Construct` instances.
 *
 * Beyond the built-in special cases, and similar to how `JSON.stringify()`
 * knows to look for a `.toJSON()` method, this class understands the
 * symbol-named method `DataValues.TO_DATA` to be an override of the default
 * `toData()` behavior. The expectation is that most such custom converters
 * end up producing `Construct` instances (though that isn't strictly required).
 */
export class DataValues {
  /**
   * @type {symbol} Converted value which is returned to indicate "omit this."
   */
  static #OMIT = Symbol('DataValues.OMIT');

  /** @type {symbol} Value for the exposed {@link #TO_DATA}. */
  static #TO_DATA = Symbol('DataValues.TO_DATA');

  /**
   * @type {symbol} Name of method to define, in order to override the default
   * behavior of {@link #toData} on a non-plain object.
   */
  static get TO_DATA() {
    return this.#TO_DATA;
  }

  /**
   * Produces a data-value representation of the given value or object,
   * including recursive conversion of sub-objects.
   *
   * **Note:** This does not currently handle self-referential structures at
   * all.
   *
   * @param {*} orig Value to convert.
   * @param {?ConverterConfig} config Configuration to use, or `null` to use the
   *   default configuration.
   * @returns {*} The converted version.
   */
  static toData(orig, config = null) {
    config ??= new ConverterConfig();

    const result = this.#toData0(orig, config);

    return (result === this.#OMIT) ? undefined : result;
  }

  /**
   * Helper for {@link #toData}, which does most of the work and is also the
   * recursive re-entry point for the conversion procedure.
   *
   * @param {*} orig Value to convert.
   * @param {object} config Conversion configuration.
   * @returns {*} The converted version.
   */
  static #toData0(orig, config) {
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
        return this.#performReplacement(orig, config.functionAction, config);
      }

      case 'object': {
        if (orig === null) {
          return null;
        } else if (Array.isArray(orig)) {
          return this.#objectOrArrayToData(orig, true, config);
        } else if (AskIf.plainObject(orig)) {
          return this.#objectOrArrayToData(orig, false, config);
        } else if (config.isDataInstance(orig)) {
          const toConvert   = Object.freeze(orig.toConvertibleValue());
          const replacement = this.#toData0(toConvert, config);
          return (replacement === toConvert)
            ? orig
            : orig.withConvertedValue(replacement);
        }

        if (config.specialCases) {
          const replacement = config.specialCases.dataFromValue(orig);
          if (replacement !== BaseConverter.UNHANDLED) {
            return this.#toData0(replacement, config);
          }
        }

        if (config.honorToData && orig[this.#TO_DATA]) {
          const replacement = orig[this.#TO_DATA]();
          return this.#toData0(replacement, config);
        } else {
          return this.#performReplacement(orig, config.instanceAction, config);
        }
      }
    }

    // JavaScript added a new type after this code was written!
    throw new Error(`Unrecognized \`typeof\` result: ${typeof orig}`);
  }

  /**
   * Helper for {@link #toData0}, which performs conversion of arrays and
   * plain objects.
   *
   * @param {*} orig Value to convert.
   * @param {boolean} isArray Is `orig` an array?
   * @param {object} config Conversion configuration.
   * @returns {*} The converted version.
   */
  static #objectOrArrayToData(orig, isArray, config) {
    if (   (config.symbolKeyAction === 'error')
        && (Object.getOwnPropertySymbols(orig).length !== 0)) {
      throw new Error(`Encountered symbol key in ${isArray ? 'array' : 'object'}.`);
    }

    // Note: The `Array()` form is needed in case `orig` is a sparse array with
    // unbound indices at the end.
    const result  = isArray ? Array(orig.length) : {};
    let anyChange = false;

    for (const [key, value] of Object.entries(orig)) {
      const newValue = this.#toData0(value, config);
      anyChange ||= (value !== newValue);
      if (newValue !== this.#OMIT) {
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
   * Helper for {@link #toData0}, which performs a replacement action as
   * defined by the replacer configuration.
   *
   * @param {*} orig Value to convert.
   * @param {string|function(*): *} replacer The replacer option value to use.
   * @param {object} config Conversion configuration.
   * @returns {*} The converted version.
   */
  static #performReplacement(orig, replacer, config) {
    switch (replacer) {
      case 'error':    throw new Error('Encountered non-data.');
      case 'inspect':  return util.inspect(orig);
      case 'omit':     return this.#OMIT;
      case 'asObject': return this.#objectOrArrayToData(orig, false, config);
      case 'wrap':     return new NonData(orig);
      default: {
        // `|| null` to make the call be a function (not method) call.
        const replacement = (replacer || null)(orig);
        return this.#toData0(replacement);
      }
    }
  }
}
