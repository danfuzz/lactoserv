// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingRequest, OutgoingResponse } from '@this/net-util';
import { MustBe } from '@this/typey';

import { IntfRequestLogger } from '#x/IntfRequestLogger';


/**
 * Logger for HTTP-ish requests.
 */
export class RequestLogHelper {
  /** @type {IntfRequestLogger} Request logger service to use. */
  #requestLogger;

  /**
   * Constructs an instance.
   *
   * @param {IntfRequestLogger} requestLogger Request logger service to use.
   */
  constructor(requestLogger) {
    this.#requestLogger = MustBe.object(requestLogger);
  }

  /**
   * Causes the indicated {@link IncomingRequest} to be logged once completed.
   * Also logs various intermediate details to the `IncomingRequest`'s _system_
   * logger.
   *
   * @param {IncomingRequest} request Request object.
   * @param {Promise<OutgoingResponse>} responsePromise Promise for the
   *   response which was sent, which becomes resolved after it is believed to
   *   have been sent.
   * @param {object} networkInfo Miscellaneous network info. See {@link
   *   IntfRequestLogger#requestStarted}.
   */
  async logRequest(request, responsePromise, networkInfo) {
    const reqLogger  = this.#requestLogger;
    const timingInfo = { start: reqLogger.now() };

    reqLogger.requestStarted(networkInfo, timingInfo, request);

    const response = await responsePromise;

    timingInfo.end      = this.#requestLogger.now();
    timingInfo.duration = timingInfo.end.subtract(timingInfo.start);

    reqLogger.requestEnded(networkInfo, timingInfo, request, response);
  }
}
