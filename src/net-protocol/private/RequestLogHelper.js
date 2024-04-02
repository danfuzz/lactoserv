// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingRequest } from '@this/net-util';
import { MustBe } from '@this/typey';

import { IntfRequestLogger } from '#x/IntfRequestLogger';


/**
 * Logger for HTTP-ish requests.
 */
export class RequestLogHelper {
  /**
   * Request logger service to use.
   *
   * @type {IntfRequestLogger}
   */
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
   * @param {object} networkInfo Miscellaneous network info. See {@link
   *   IntfRequestLogger#requestStarted}.
   */
  async logRequest(request, networkInfo) {
    const reqLogger  = this.#requestLogger;

    reqLogger.requestStarted(networkInfo, request);

    const response = await networkInfo.responsePromise;

    reqLogger.requestEnded(networkInfo, request, response);
  }
}
