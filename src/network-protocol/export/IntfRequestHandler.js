// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

import { Request } from '#x/Request';


/**
 * Interface for HTTP(ish) request handlers, as used by this module.
 *
 * @interface
 */
export class IntfRequestHandler {
  /**
   * Asks this instance to handle the given request; that is, parse it, act on
   * it, and provide a response. Returning / throwing from this method has the
   * following meaning:
   *
   * * Returning `true` means that the request was fully handled. (In Express,
   *   this is achieved by not-calling `next()` at all.)
   * * Returning `false` means that the request was not handled. (In Express,
   *   this is achieved by calling `next()` or `next('route')`, that is, with no
   *   argument or the single literal argument `'route'`.)
   * * Throwing an error means that the request failed fatally. (In Express,
   *   this is achieved by calling `next(error)`, that is, passing it an `Error`
   *   object.)
   *
   * **Note:** Express differentiates between `next()` and `next('route')`, but
   * the nature of this system is that there is no distinction, because there
   * are no sub-chained routes. To achieve that effect, a concrete
   * implementation of this class would instead perform its own internal route
   * chaining.
   *
   * @abstract
   * @param {Request} request Request object.
   * @returns {boolean} Was the request handled? Flag as described above.
   * @throws {Error} Thrown in case of fatal error.
   */
  async handleRequest(request) {
    throw Methods.abstract(request);
  }
}
