// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as util from 'node:util';

import { AskIf } from '@this/typey';

import { Construct } from '#x/Construct';
import { NonData } from '#x/NonData';

// TODO: Handle self-referential structures.

// TODO: Is there a sane way to know if an array is non-sparse and has no extra
// properties? If so, it might be more efficient to iterate directly over such
// arrays, as opposed to using `Object.entries()` and the like.

/**
 * Converter utilities for data values. For the purposes of this class, "data
 * values" are a superset of what can be represented in JSON. Here is a
 * run-down:
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
 *   effectively an "escape hatch."
 *
 * Similar to how `JSON.stringify()` knows to look for a `.toJSON()` method,
 * this class understands the symbol-named method `DataValues.TO_DATA` to be an
 * override of the default `toData()` behavior.
 */
export class DataValues {
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
   * including recursive conversion of sub-objects. The options include a few
   * common enum-like strings as possibilities for how to treat a non-data
   * value:
   *
   * * `error` -- Treat the case as an error.
   * * `asObject` -- Process the value as if it were a plain object.
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
   *
   * **Note:** This does not currently handle self-referential structures at
   * all.
   *
   * @param {*} orig Value to convert.
   * @param {object} [options = {}] Options for conversion. These include:
   *   `dataClasses: [...class]` -- Classes whose instances are to be allowed
   *     as-is to be treated as "data" (and not converted in any way). Default:
   *     `[Construct, NonData]`.
   *   `freeze: boolean` -- Whether to guarantee a frozen result. Default
   *     `true`.
   *   `functionAction: string|function` -- What to do if a function reference
   *     is encountered. May be any of the treatment values described above.
   *     Default `inspect`.
   *   `honorToData: boolean` -- Whether or not to honor objects' defined
   *     `Symbol.TO_DATA` methods. Default `true`.
   *   `instanceAction: string|function` -- What to do if an instance (non-plain
   *     object) is encountered (that isn't covered by other options). May be
   *     any of the treatment values described above. Default `inspect`.
   *   `symbolKeyAction: string` -- What to do if a symbol-keyed property is
   *     encountered in an otherwise plain object or array. Only valid to be
   *     `error` or `omit`. Default `omit`.
   * @returns {*} The converted version.
   */
  static toData(orig, options = {}) {
    options = {
      dataClasses:     [Construct, NonData],
      freeze:          true,
      functionAction:  'inspect',
      honorToData:     true,
      instanceAction:  'inspect',
      symbolKeyAction: 'omit',
      ...options
    };

    // Convert `dataClasses` to a predicate.
    const dataClasses = [...options.dataClasses];
    options.isDataInstance = (obj) => {
      for (const dc of dataClasses) {
        if (obj instanceof dc) {
          return true;
        }
      }
      return false;
    };

    const result = this.#toData0(orig, options);

    return (result === this.#OMIT) ? undefined : result;
  }

  /**
   * Helper for {@link #toData}, which does most of the work and is also the
   * recursive re-entry point for the conversion procedure.
   *
   * @param {*} orig Value to convert.
   * @param {object} options Options for conversion.
   * @returns {*} The converted version.
   */
  static #toData0(orig, options) {
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
        return this.#performReplacement(orig, options.functionAction, options);
      }

      case 'object': {
        if (orig === null) {
          return null;
        } else if (Array.isArray(orig)) {
          return this.#objectOrArrayToData(orig, true, options);
        } else if (AskIf.plainObject(orig)) {
          return this.#objectOrArrayToData(orig, false, options);
        } else if (options.isDataInstance(orig)) {
          return orig;
        } else if (options.honorToData && orig[this.#TO_DATA]) {
          const replacement = orig[this.#TO_DATA]();
          return this.#toData0(replacement, options);
        } else {
          return this.#performReplacement(orig, options.instanceAction, options);
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
   * @param {object} options Options for conversion.
   * @returns {*} The converted version.
   */
  static #objectOrArrayToData(orig, isArray, options) {
    if (   (options.symbolKeyAction === 'error')
        && (Object.getOwnPropertySymbols(orig).length !== 0)) {
      throw new Error(`Encountered symbol key in ${isArray ? 'array' : 'object'}.`);
    }

    // Note: The `Array()` form is needed in case `orig` is a sparse array with
    // unbound indices at the end.
    const result  = isArray ? Array(orig.length) : {};
    let anyChange = false;

    for (const [key, value] of Object.entries(orig)) {
      const newValue = this.toData(value, options);
      anyChange ||= (value !== newValue);
      if (newValue !== this.#OMIT) {
        result[key] = newValue;
      }
    }

    if (options.freeze) {
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
   * defined by one of the replacer options.
   *
   * @param {*} orig Value to convert.
   * @param {string|function(*): *} replacer The replacer option value to use.
   * @param {object} options Options for conversion.
   * @returns {*} The converted version.
   */
  static #performReplacement(orig, replacer, options) {
    switch (replacer) {
      case 'error':    throw new Error('Encountered non-data.');
      case 'inspect':  return util.inspect(orig);
      case 'omit':     return this.#OMIT;
      case 'asObject': return this.#objectOrArrayToData(orig, false, options);
      case 'wrap':     return new NonData(orig);
      default: {
        // `|| null` to make the call be a function (not method) call.
        const replacement = (replacer || null)(orig);
        return this.#toData0(replacement);
      }
    }
  }
}
