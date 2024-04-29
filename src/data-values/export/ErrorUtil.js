// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utilities for dealing with `Error` objects.
 */
export class ErrorUtil {
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
