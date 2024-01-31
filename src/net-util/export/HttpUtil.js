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
  static statusMayHaveBody(status) {
    return (status <= 199)
      || (status === 200) || (status === 201)
      || (status === 204) || (status === 205)
      || (status === 304)
      || (status >= 400);
  }
}
