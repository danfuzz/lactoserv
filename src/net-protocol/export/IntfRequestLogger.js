// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/data-values';
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
   * @param {object} timingInfo Information about request timing.
   * @param {Moment} timingInfo.start The moment the request started getting
   *   handled (or at least a reasonably close moment to that). This can be
   *   expected to be a value returned from a call to {@link #now} on this
   *   instance.
   * @param {object} requestInfo Reasonably-logged information about the
   *   incoming request. See {@link IncomingRequest#getLoggableRequestInfo} for
   *   details.
   */
  async requestStarted(timingInfo, requestInfo) {
    Methods.abstract(timingInfo, requestInfo);
  }

  /**
   * Indicates to this instance that a request has ended.
   *
   * @abstract
   * @param {object} timingInfo Information about request timing.
   * @param {Moment} timingInfo.start Same as with {@link #requestStarted}.
   * @param {Moment} timingInfo.end The moment the request was considered
   *   complete. This can be expected to be a value returned from a call to
   *   {@link #now} on this instance.
   * @param {object} requestInfo Reasonably-logged information about the
   *   incoming request. See {@link IncomingRequest#getLoggableRequestInfo} for
   *   details.
   * @param {object} responseInfo Reasonably-logged information about the
   *   incoming request. See {@link OutgoingResponse#getLoggableResponseInfo}
   *   for details.
   */
  async requestEnded(timingInfo, requestInfo, responseInfo) {
    Methods.abstract(timingInfo, requestInfo, responseInfo);
  }
}
