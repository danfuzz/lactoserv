// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as util from 'node:util';

import { AskIf } from '@this/typey';

import { BaseConverter } from '#x/BaseConverter';
import { Construct } from '#x/Construct';
import { NonData } from '#x/NonData';
import { SpecialConverters } from '#x/SpecialConverters';

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
   *   `dataClasses: [...class]` -- Classes whose instances are to be allowed to
   *     be treated as "data" as-is (and not converted in any way). Default:
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
   *   `specialConverters: ?BaseConverter` -- Any special converters to use,
   *     to override class-defined data converters and/or provide such
   *     conversion for classes that don't have them (such as built-in
   *     JavaScript classes). Default {@link SpecialConverters#STANDARD}.
   *   `symbolKeyAction: string` -- What to do if a symbol-keyed property is
   *     encountered in an otherwise plain object or array. Only valid to be
   *     `error` or `omit`. Default `omit`.
   * @returns {*} The converted version.
   */
  static toData(orig, options = {}) {
    options = {
      dataClasses:       [Construct, NonData],
      freeze:            true,
      functionAction:    'inspect',
      honorToData:       true,
      instanceAction:    'inspect',
      specialConverters: SpecialConverters.STANDARD,
      symbolKeyAction:   'omit',
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
        }

        if (options.specialConverters) {
          const replacement = options.specialConverters.dataFromValue(orig);
          if (replacement !== BaseConverter.UNHANDLED) {
            return replacement;
          }
        }

        if (options.honorToData && orig[this.#TO_DATA]) {
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
