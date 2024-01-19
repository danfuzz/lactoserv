// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as http2 from 'node:http2';

import { Moment } from '@this/data-values';
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
  logRequest(request, context) {
    const { expressRequest: req, expressResponse: res, logger } = request;

    const startTime = logger?.$env.now();
    const urlish    = `${req.protocol}://${request.host.nameString}${request.urlString}`;
    const origin    = context.socketAddressPort ?? '<unknown-origin>';
    const method    = request.method;

    context.logger?.newRequest(request.id);
    logger?.opened(context.ids);
    logger?.request(origin, method, urlish);
    logger?.headers(RequestLogHelper.#sanitizeRequestHeaders(req.headers));

    const cookies = req.cookies;
    if (cookies) {
      logger?.cookies(cookies);
    }

    res.on('finish', () => {
      const resHeaders    = res.getHeaders();
      const contentLength = resHeaders['content-length'] ?? 0;

      // Check to see if the connection socket has errored out. If so, indicate
      // as much.
      const connError = context.socket.errored;
      let   errorMsg  = 'ok';
      if (connError) {
        if (connError.code) {
          errorMsg = connError.code.toLowerCase().replaceAll(/_/g, '-');
        } else if (connError.message) {
          errorMsg = connError.message.slice(0, 32).toLowerCase()
            .replaceAll(/[_ ]/g, '-')
            .replaceAll(/[^-a-z0-9]/g, '');
        } else {
          errorMsg = 'err-unknown';
        }
        logger?.connectionError(errorMsg);
      }

      logger?.response(res.statusCode,
        RequestLogHelper.#sanitizeResponseHeaders(resHeaders));

      const endTime  = logger?.$env.now();
      const duration = endTime.subtract(startTime);

      logger?.closed({ contentLength, duration });

      const requestLogLine = [
        Moment.stringFromSecs(Date.now() / 1000, { decimals: 4 }),
        origin,
        method,
        JSON.stringify(urlish),
        res.statusCode,
        FormatUtils.byteCountString(contentLength, { spaces: false }),
        duration.toString({ spaces: false }),
        errorMsg
      ].join(' ');

      logger?.requestLog(requestLogLine);
      this.#requestLogger?.logCompletedRequest(requestLogLine);
    });
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

    delete result[http2.sensitiveHeaders];
    delete result[':authority'];
    delete result[':method'];
    delete result[':path'];
    delete result[':scheme'];
    delete result.host;

    return result;
  }

  /**
   * Cleans up response headers for logging.
   *
   * @param {object} headers Original response headers.
   * @returns {object} Cleaned up version.
   */
  static #sanitizeResponseHeaders(headers) {
    const result = { ...headers };

    delete result[':status'];

    return result;
  }
}
