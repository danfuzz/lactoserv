// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Utility class for various HTTP stuff.
 */
export class HttpUtil {
  /**
   * Given an HTTP(ish) response request method and status code, indicates if
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
   * Given an HTTP(ish) response request method and status code, indicates if
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

  /**
   * Given an HTTP(ish) response status code, indicates if the response is
   * allowed to be cached.
   *
   * @param {number} status Status code.
   * @returns {boolean} `true` if a response is cacheable, or `false` if not.
   */
  static responseIsCacheableFor(status) {
    switch (status) {
      case 200: case 203: case 204: case 206:
      case 300: case 301: case 308:
      case 404: case 405: case 410: case 414:
      case 501: {
        return true;
      }
    }

    return false;
  }
}
