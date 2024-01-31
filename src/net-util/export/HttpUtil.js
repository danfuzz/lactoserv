// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utility class for various HTTP stuff.
 */
export class HttpUtil {
  /**
   * Given an HTTP(ish) response status code, indicates if the corresponding
   * response _is allowed to_ include a body.
   *
   * @param {number} status code
   * @returns {boolean} `true` if a body is possibly allowed, or `false` if it
   *   definitely is not allowed.
   */
  static statusMayHaveBody(status)
  {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if (status <= 199) {
      return false;
    }

    switch (status) {
      case 204: case 205: case 304: {
        return false;
      }
    }

    return true;
  }
}
