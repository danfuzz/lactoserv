// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ErrorUtil } from '@this/data-values';
import { FormatUtils } from '@this/loggy';
import { Request } from '@this/net-util';

import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { WranglerContext } from '#x/WranglerContext';


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
   */
  async logRequest(request, context) {
    const logger    = request.logger;
    const startTime = this.#requestLogger.now();
    const reqInfo   = request.getLoggableRequestInfo();

    logger?.request(reqInfo);

    // Note: This call isn't supposed to `throw`, even if there were errors
    // thrown during handling.
    const info = await request.getLoggableResponseInfo();

    const endTime  = this.#requestLogger.now();
    const duration = endTime.subtract(startTime);

    // Rearrange `info` into preferred loggable form, and augment with
    // connection error info if appropriate.

    const {
      contentLength,
      errors,
      errorCodes,
      headers,
      statusCode
    } = info;

    let { ok } = info;

    const connectionError = context.socket.errored ?? null;

    if (connectionError) {
      const code = ErrorUtil.extractErrorCode(connectionError);

      errors.connection = connectionError;
      errorCodes.push(code);
      ok = false;
    }

    const codeStr = ok ? 'ok' : errorCodes.join(',');

    // This is to avoid redundancy and to end up with a specific propery order
    // in `finalInfo` (for human readability).
    delete info.contentLength;
    delete info.errorCodes;
    delete info.headers;
    delete info.ok;
    delete info.statusCode;

    const finalInfo = {
      ok,
      code: codeStr,
      duration,
      status: statusCode,
      contentLength,
      headers,
      ...info
    };

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
