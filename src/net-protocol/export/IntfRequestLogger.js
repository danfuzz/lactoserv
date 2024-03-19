// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage, ServerResponse } from 'node:http';
import { Http2ServerRequest, Http2ServerResponse } from 'node:http2';

import { Duration, Moment } from '@this/data-values';
import { IncomingRequest, OutgoingResponse } from '@this/net-util';
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
   * Logs a completed request.
   *
   * @abstract
   * @param {string} line Line representing the completed request.
   */
  async logCompletedRequest(line) {
    Methods.abstract(line);
  }

  /**
   * Indicates to this instance that a request has started.
   *
   * @abstract
   * @param {object} networkInfo Information about the network environment.
   * @param {object} networkInfo.connectionSocket The socket (or socket-like
   *   object) used by the lowest level of the connection that the request is
   *   running on.
   * @param {IncomingMessage|Http2ServerRequest} networkInfo.nodeRequest
   *   Low-level request object.
   * @param {ServerResponse|Http2ServerResponse} networkInfo.nodeResponse
   *   Low-level response object.
   * @param {object} timingInfo Information about request timing.
   * @param {Moment} timingInfo.start The moment the request started getting
   *   handled (or at least a reasonably close moment to that). This can be
   *   expected to be a value returned from a call to {@link #now} on this
   *   instance.
   * @param {IncomingRequest} request The incoming request.
   */
  async requestStarted(networkInfo, timingInfo, request) {
    Methods.abstract(networkInfo, timingInfo, request);
  }

  /**
   * Indicates to this instance that a request has ended (that is, its response
   * has been sent).
   *
   * @abstract
   * @param {object} networkInfo Information about the network environment. See
   *   {@link #requestStarted} for details.
   * @param {object} timingInfo Information about request timing.
   * @param {Moment} timingInfo.start Same as with {@link #requestStarted}.
   * @param {Moment} timingInfo.end The moment the request was considered
   *   complete. This can be expected to be a value returned from a call to
   *   {@link #now} on this instance.
   * @param {Duration} timingInfo.duration The difference `end - start`.
   * @param {IncomingRequest} request The incoming request.
   * @param {OutgoingResponse} response The response that was sent.
   */
  async requestEnded(networkInfo, timingInfo, request, response) {
    Methods.abstract(networkInfo, timingInfo, request, response);
  }
}
