// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { inspect } from 'node:util';

import { AskIf } from '@this/typey';

import { StackTrace } from '#x/StackTrace';


// TODO: This should handle circular data structures.

/**
 * Converter of arbitrary values to better-loggable data. The results of
 * conversion are always deeply frozen and JSON-encodable.
 */
export class DataConverter {
  /**
   * Converts (if and as necessary) an arbitrary value.
   *
   * @param {*} value The original value.
   * @returns {*} The converted form.
   */
  static fix(value) {
    switch (typeof value) {
      case 'boolean':
      case 'string': {
        return value;
      }
      case 'bigint': {
        return this.fix({ '@bigint': value.toString() });
      }
      case 'function': {
        return this.fix({ '@function': value.name });
      }
      case 'number': {
        if (Number.isFinite(value)) {
          return value;
        } else if (Number.isNaN(value)) {
          return this.#REP_NAN;
        } else if (value === Number.POSITIVE_INFINITY) {
          return this.#REP_POS_INFINITY;
        } else {
          return this.#REP_NEG_INFINITY;
        }
      }
      case 'object': {
        if (value === null) {
          return value;
        } else if (Array.isArray(value)) {
          return this.#fixArray(value);
        } else if (AskIf.plainObject(value)) {
          return this.#fixPlainObject(value);
        } else {
          return this.#fixInstance(value);
        }
      }
      case 'symbol': {
        return this.fix({ '@symbol': value.description });
      }
      case 'undefined': {
        return this.#REP_UNDEFINED;
      }
    }

    throw new Error(`Unknown type: ${typeof value}`);
  }

  /**
   * Helper for {@link #fix}, which processes arrays.
   *
   * @param {*[]} arr The original value.
   * @returns {*[]} The converted form.
   */
  static #fixArray(arr) {
    const result = arr.map((v) => this.fix(v));

    return Object.freeze(result);
  }

  /**
   * Helper for {@link #fix}, which processes instances (non-plain objects).
   *
   * @param {object} obj The original value.
   * @returns {object} The converted form.
   */
  static #fixInstance(obj) {
    if (obj instanceof Error) {
      // Special case to make these nicer than would otherwise result.
      const result = { ...obj }; // Get all the non-special properties.
      result['@name'] = obj.constructor.name;
      result['@message'] = obj.message;
      result['@stack'] = StackTrace.framesFrom(obj);
      if (obj.cause) {
        result['@cause'] = obj.cause;
      }
      return this.fix({ '@error': result });
    } else {
      // TODO: Do better!
      const inspected = inspect(obj);
      return this.fix({ '@object': inspected });
    }
  }

  /**
   * Helper for {@link #fix}, which processes plain objects.
   *
   * @param {object} obj The original value.
   * @returns {object} The converted form.
   */
  static #fixPlainObject(obj) {
    const entries = Object.entries(obj);

    for (const entry of entries) {
      entry[1] = this.fix(entry[1]);
    }

    return Object.freeze(Object.fromEntries(entries));
  }

  /** @type {object} Pre-converted value `NaN`. */
  static #REP_NAN = this.fix({ '@number': ['nan'] });

  /** @type {object} Pre-converted value `-Infinity`. */
  static #REP_NEG_INFINITY = this.fix({ '@number': ['-infinity'] });

  /** @type {object} Pre-converted value `+Infinity`. */
  static #REP_POS_INFINITY = this.fix({ '@number': ['infinity'] });

  /** @type {object} Pre-converted value `undefined`. */
  static #REP_UNDEFINED = this.fix({ '@undefined': [] });
}
