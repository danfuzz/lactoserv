// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

import { DispatchInfo } from '#x/DispatchInfo';
import { Request } from '#x/Request';
import { Response } from '#x/Response';


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
   * * Returning `null` or `false` means that the request was not handled.
   * * Throwing an error means that the request failed fatally.
   * * Returning an instance of {@link Response} indicates the response to
   *   ultimately send.
   *
   * @abstract
   * @param {Request} request Request object.
   * @param {?DispatchInfo} dispatch Dispatch information, or `null` if no
   *   dispatch determination was made before calling this instance. (On any
   *   given instance -- depending on context -- it should be the case that it
   *   either _always_ or _never_ gets passed `null` for this parameter.)
   * @returns {?Response|boolean} Result of handling the request, or `null` if
   *   not handled by this instance.
   * @throws {Error} Thrown in case of fatal error.
   */
  async handleRequest(request, dispatch) {
    throw Methods.abstract(request, dispatch);
  }
}
