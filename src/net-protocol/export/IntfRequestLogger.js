// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/data-values';
import { IncomingRequest, OutgoingResponse, TypeNodeRequest, TypeNodeResponse }
  from '@this/net-util';
import { Methods } from '@this/typey';


/**
 * Interface for (HTTP-ish) request loggers, as used by this module. Instances
 * of this interface get an opportunity to perform logging at the start of
 * requests and when the request/response cycle has ended. It is of course
 * a-okay for instances to choose to ignore one or the other.
 *
 * @interface
 */
export class IntfRequestLogger {
  /**
   * Gets this instance's idea of what the current time is.
   *
   * @returns {Moment} The current time.
   */
  now() {
    return Methods.abstract();
  }

  /**
   * Indicates to this instance that a request has started.
   *
   * @abstract
   * @param {object} networkInfo Information about the network environment.
   * @param {object} networkInfo.connectionSocket The socket (or socket-like
   *   object) used by the lowest level of the connection that the request is
   *   running on.
   * @param {TypeNodeRequest} networkInfo.nodeRequest Low-level request object.
   * @param {TypeNodeResponse} networkInfo.nodeResponse Low-level response
   *   object.
   * @param {Promise<OutgoingResponse>} networkInfo.responsePromise Promise for
   *   the response object which was sent, which becomes resolved after the
   *   response is believed to have been sent.
   * @param {IncomingRequest} request The incoming request.
   */
  async requestStarted(networkInfo, request) {
    Methods.abstract(networkInfo, request);
  }

  /**
   * Indicates to this instance that a request has ended (that is, its response
   * has been sent).
   *
   * @abstract
   * @param {object} networkInfo Information about the network environment. See
   *   {@link #requestStarted} for details.
   * @param {IncomingRequest} request The incoming request.
   * @param {OutgoingResponse} response The response that was sent (or at least
   *   attempted).
   */
  async requestEnded(networkInfo, request, response) {
    Methods.abstract(networkInfo, request, response);
  }
}
