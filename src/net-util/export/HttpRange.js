// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HttpHeaders } from '#x/HttpHeaders';


/**
 * Utility class for HTTP range handling.
 */
export class HttpRange {
  /** @type {string} The range unit which is recognized. */
  static #UNIT = 'bytes';

  /**
   * Sets on the given headers the response headers indicating that a range
   * request would have been acceptable.
   *
   * @param {HttpHeaders} headers The headers to add to.
   */
  static setBasicResponseHeaders(headers) {
    headers.set('accept-ranges', this.#UNIT);
  }
}
