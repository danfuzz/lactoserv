// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse, IncomingRequest, TypeNodeResponse }
  from '@this/net-util';
import { Methods } from '@this/typey';


/**
 * Interface for network access loggers, as in the things that record the
 * details of network requests and responses. Instances of this interface get an
 * opportunity to perform logging at the start of requests and when the
 * request/response cycle has ended. It is of course a-okay for instances to
 * choose to ignore one or the other.
 *
 * @interface
 */
export class IntfAccessLog {
  /**
   * Indicates to this instance that a request has started.
   *
   * @abstract
   * @param {IncomingRequest} request The incoming request.
   * @returns {boolean} Whether or not the event was handled.
   */
  async _impl_handleEvent_requestStarted(request) {
    throw Methods.abstract(request);
  }

  /**
   * Indicates to this instance that a request has ended (that is, its response
   * has been sent).
   *
   * @abstract
   * @param {IncomingRequest} request The incoming request.
   * @param {FullResponse} response The response that was sent (or at least
   *   attempted).
   * @param {object} networkInfo Information about the network environment.
   * @param {object} networkInfo.connectionSocket The socket (or socket-like
   *   object) used by the lowest level of the connection that the request is
   *   running on.
   * @param {TypeNodeResponse} networkInfo.nodeResponse Low-level response
   *   object.
   * @returns {boolean} Whether or not the event was handled.
   */
  async _impl_handleEvent_requestEnded(request, response, networkInfo) {
    throw Methods.abstract(request, response, networkInfo);
  }
}
