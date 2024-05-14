// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


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
        errorCodes: [],
        errors:     {},
        ok:         true
      };
    } else {
      return {
        errorCodes: [...errorCodes].sort(),
        errors:     resultErrors,
        ok:         false
      };
    }
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
        .replaceAll(/[^- _A-Za-z0-9]/g, '')
        .slice(0, 30)
        .toLowerCase()
        .replaceAll(/[_ ]/g, '-');
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
}
