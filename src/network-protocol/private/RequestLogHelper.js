// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http2 from 'node:http2';

import { FormatUtils } from '@this/loggy';

import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { Request } from '#x/Request';
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
   * @param {WranglerContext} context Connection or session context.
   */
  async logRequest(request, context) {
    const {
      cookies,
      headers: reqHeaders,
      logger,
      method,
      urlForLogging
    } = request;

    const startTime = this.#requestLogger.now();
    const origin    = context.socketAddressPort ?? '<unknown-origin>';

    context.logger?.newRequest(request.id);
    logger?.opened(context.ids);
    logger?.request(origin, method, urlForLogging);
    logger?.headers(RequestLogHelper.#sanitizeRequestHeaders(reqHeaders));

    if (cookies) {
      logger?.cookies(cookies);
    }

    // Note: This call isn't supposed to `throw`, even if there were errors
    // thrown during handling.
    const info = await request.getLoggableResponseInfo();

    const endTime  = this.#requestLogger.now();
    const duration = endTime.subtract(startTime);

    // Rearrange `info` into preferred loggable form.

    const {
      contentLength,
      errors,
      fullErrors,
      headers: resHeaders,
      statusCode
    } = info;

    const code = errors ?? 'ok';

    delete info.contentLength;
    delete info.errors;
    delete info.fullErrors;
    delete info.headers;
    delete info.ok;
    delete info.statusCode;

    const finalInfo = {
      code,
      duration,
      status: statusCode,
      contentLength,
      headers: resHeaders,
      ...info
    };

    logger?.response(finalInfo);

    if (fullErrors) {
      logger?.errors(fullErrors);
    }

    const requestLogLine = [
      endTime.toString({ decimals: 4 }),
      origin,
      method,
      JSON.stringify(urlForLogging),
      statusCode,
      FormatUtils.byteCountString(contentLength, { spaces: false }),
      duration.toString({ spaces: false }),
      code
    ].join(' ');

    logger?.requestLog(requestLogLine);
    this.#requestLogger?.logCompletedRequest(requestLogLine);
  }


  //
  // Static members
  //

  /**
   * Cleans up request headers for logging.
   *
   * @param {object} headers Original request headers.
   * @returns {object} Cleaned up version.
   */
  static #sanitizeRequestHeaders(headers) {
    const result = { ...headers };

    delete result[':authority'];
    delete result[':method'];
    delete result[':path'];
    delete result[':scheme'];
    delete result.host;

    // Non-obvious: This deletes the symbol property `http2.sensitiveHeaders`
    // from the result (whose array is a value of header names that, per Node
    // docs, aren't supposed to be compressed due to poor interaction with
    // desirable cryptography properties). This _isn't_ supposed to actually
    // delete the headers named by this value.
    delete result[http2.sensitiveHeaders];

    return result;
  }
}
