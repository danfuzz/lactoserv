// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfDeconstructable } from '@this/sexp';

import { StackTrace } from '#x/StackTrace';


/**
 * Utilities for dealing with `Error` objects.
 */
export class ErrorUtil {
  /**
   * Collects and collates errors from a number of sources, producing a
   * "uniqued" result (without any redundantly-listed info). The result includes
   * an `ok` indicator (were there no errors?), a sorted array of unique error
   * codes (extracted by {@link #extractErrorCode}), and an object like the one
   * given as an argument, except replacing duplicate errors with string
   * references.
   *
   * @param {object} errors Object which binds each key to a corresponding
   *   error-or-nullish.
   * @returns {{ errorCodes: Array<string>, errors: object, ok: boolean }}
   *   Collected results.
   */
  static collateErrors(errors) {
    const errorCodes   = new Set();
    const errorMap     = new Map();
    const resultErrors = {};

    for (const [k, e] of Object.entries(errors)) {
      if ((e === null) || (e === undefined)) {
        continue;
      }

      const already = errorMap.get(e);

      if (already) {
        resultErrors[k] = already;
      } else {
        resultErrors[k] = e;
        errorCodes.add(ErrorUtil.extractErrorCode(e));
        errorMap.set(e, k);
      }
    }

    if (errorCodes.size === 0) {
      return {
        ok:         true,
        errorCodes: [],
        errors:     {}
      };
    } else {
      return {
        ok:         false,
        errorCodes: [...errorCodes].sort(),
        errors:     resultErrors
      };
    }
  }

  /**
   * Encodes an `Error` instance into a standardized "deconstructed" form, along
   * the lines of what is defined for {@link IntfDeconstructable#deconstruct}.
   *
   * @param {*} error The error to process.
   * @returns {Array} The deconstructed form.
   */
  static deconstructError(error) {
    if (!(error instanceof Error)) {
      return [Error, {
        name:    'Error',
        message: `${error}`
      }];
    }

    const { cause, code, errors, message, name } = error;
    const type  = error.constructor;
    const stack = this.#deconstructStack(error);
    const rest  = { ...error };
    const main  = {
      name: name ?? type.name ?? 'Error',
      code,
      message: message ?? '',
      stack,
      cause,
      errors
    };

    delete rest.cause;
    delete rest.code;
    delete rest.errors;
    delete rest.message;
    delete rest.name;
    delete rest.stack;

    if (!main.cause)  delete main.cause;
    if (!main.code)   delete main.code;
    if (!main.errors) delete main.errors;
    if (!main.stack)  delete main.stack;

    return (Object.getOwnPropertyNames(rest).length === 0)
      ? [type, main]
      : [type, main, rest];
  }

  /**
   * Extracts a string error code from the given `Error`, or returns a generic
   * "unknown error" if there's nothing else reasonable.
   *
   * @param {*} error The error to extract from.
   * @returns {string} The extracted code.
   */
  static extractErrorCode(error) {
    const shortenAndFormat = (str) => {
      return str
        .replaceAll(/[^-_ A-Za-z0-9]|^[-_ ]+|[-_ ]+$/g, '')
        .slice(0, 30)
        .toLowerCase()
        .replaceAll(/[_ ]/g, '-')
        .replace(/-+$/, '');
    };

    if (error instanceof Error) {
      if (error.code) {
        return error.code.toLowerCase().replaceAll(/_/g, '-');
      } else if (error.message) {
        return shortenAndFormat(error.message);
      }
    } else if (typeof error === 'string') {
      return shortenAndFormat(error);
    }

    return 'err-unknown';
  }

  /**
   * Gets the appropriate value for a deconstructed `stack` property.
   *
   * @param {Error} error The original error.
   * @returns {*} The value to use in the result for {@link #deconstructError}.
   */
  static #deconstructStack(error) {
    return (typeof error.stack === 'string')
      ? new StackTrace(error)
      : null;
  }
}
