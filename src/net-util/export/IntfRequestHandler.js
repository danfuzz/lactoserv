// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Methods } from '@this/typey';

import { DispatchInfo } from '#x/DispatchInfo';
import { IncomingRequest } from '#x/IncomingRequest';
import { TypeOutgoingResponse } from '#x/TypeOutgoingResponse';


/**
 * Interface for HTTP-ish request handlers, as used by this module.
 *
 * @interface
 */
export class IntfRequestHandler {
  /**
   * Asks this instance to handle the given request; that is, parse it, act on
   * it, and either provide a response to send (or which could possibly be
   * modified or replaced by an intermediary) or return `null` to indicate that
   * the request was not handled.
   *
   * @abstract
   * @param {IncomingRequest} request Request object.
   * @param {?DispatchInfo} dispatch Dispatch information, or `null` if no
   *   dispatch determination was made before calling this instance. (On any
   *   given instance -- depending on context -- it should be the case that it
   *   either _always_ or _never_ gets passed `null` for this parameter.)
   * @returns {?TypeOutgoingResponse} Response to send.
   * @throws {Error} Thrown in case of fatal error.
   */
  async handleRequest(request, dispatch) {
    throw Methods.abstract(request, dispatch);
  }
}
