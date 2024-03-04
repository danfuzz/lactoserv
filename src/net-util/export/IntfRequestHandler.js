// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { DispatchInfo, Request } from '@this/net-util';
import { Methods } from '@this/typey';

import { DispatchInfo } from '#x/DispatchInfo';
import { Request } from '#x/DispatchInfo';


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
   * * Returning `true` means that the request was fully handled.
   * * Returning `false` means that the request was not handled.
   * * Throwing an error means that the request failed fatally.
   *
   * @abstract
   * @param {Request} request Request object.
   * @param {?DispatchInfo} dispatch Dispatch information, or `null` if no
   *   dispatch determination has yet been made.
   * @returns {boolean} Was the request handled? Flag as described above.
   * @throws {Error} Thrown in case of fatal error.
   */
  async handleRequest(request, dispatch) {
    throw Methods.abstract(request, dispatch);
  }
}
