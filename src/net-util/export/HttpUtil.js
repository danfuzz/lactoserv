// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utility class for various HTTP stuff.
 */
export class HttpUtil {
  /**
   * Given an HTTP(ish) response status code and request method, indicates if
   * the corresponding response _is allowed to_ include a body.
   *
   * @param {string} method Request method, either downcased or all-caps.
   * @param {number} status Status code.
   * @returns {boolean} `true` if a body is possibly allowed, or `false` if it
   *   definitely is not allowed.
   */
  static responseBodyIsAllowedFor(method, status) {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if ((method === 'head') || (method === 'HEAD')) {
      return (status >= 400);
    } else {
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

  /**
   * Given an HTTP(ish) response status code and request method, indicates if
   * the corresponding response _is required to_ include a body.
   *
   * @param {string} method Request method, either downcased or all-caps.
   * @param {number} status Status code.
   * @returns {boolean} `true` if a body is required, or `false` if not.
   */
  static responseBodyIsRequiredFor(method, status) {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if ((method === 'head') || (method === 'HEAD')) {
      return false;
    } else {
      switch (status) {
        case 200: case 206: {
          return true;
        }
      }

      return false;
    }
  }
}
