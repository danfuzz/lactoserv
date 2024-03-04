// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ServerResponse } from 'node:http';
import { Http2ServerResponse } from 'node:http2';

import { FormatUtils } from '@this/loggy';
import { Request, Response } from '@this/net-util';

import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { WranglerContext } from '#p/WranglerContext';


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
    this.#requestLogger = requestLogger;
  }

  /**
   * Causes the indicated {@link Request} to be logged once completed. Also
   * logs various intermediate details to the `Request`'s _system_ logger.
   *
   * @param {Request} request Request object.
   * @param {WranglerContext} context Outer context around `request`.
   * @param {ServerResponse|Http2ServerResponse} res Low-level response object.
   * @param {Promise<boolean>} resSent Promise which resolves to `true` once the
   *   response is considered complete.
   */
  async logRequest(request, context, res, resSent) {
    const startTime = this.#requestLogger.now();

    const logger    = request.logger;
    const reqInfo   = request.getLoggableRequestInfo();

    logger?.request(reqInfo);

    try {
      await resSent;
    } catch {
      // Ignore the error. `getLoggableResponseInfo()` should end up including
      // it in its list of errors.
    }

    const endTime   = this.#requestLogger.now();
    const duration  = endTime.subtract(startTime);

    // Note: This call isn't supposed to `throw`, even if there were errors
    // thrown during handling.
    const info = await Response.getLoggableResponseInfo(res, context.socket);

    // Rearrange `info` into preferred loggable form, and augment with
    // connection error info if appropriate.

    const {
      contentLength,
      errorCodes,
      ok,
      statusCode
    } = info;

    const codeStr = ok ? 'ok' : errorCodes.join(',');

    // This is to avoid redundancy and to end up with a specific propery order
    // in `finalInfo` (for human readability).
    const finalInfo = { ok, duration, ...info };

    logger?.response(finalInfo);

    const requestLogLine = [
      endTime.toString({ decimals: 4 }),
      reqInfo.origin,
      reqInfo.protocol,
      reqInfo.method,
      JSON.stringify(reqInfo.url),
      statusCode,
      FormatUtils.byteCountString(contentLength, { spaces: false }),
      duration.toString({ spaces: false }),
      codeStr
    ].join(' ');

    logger?.requestLog(requestLogLine);
    this.#requestLogger?.logCompletedRequest(requestLogLine);
  }
}
