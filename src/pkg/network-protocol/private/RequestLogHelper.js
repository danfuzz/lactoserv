// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as http2 from 'node:http2';

import * as express from 'express';

import { FormatUtils } from '@this/loggy';

import { IntfRequestLogger } from '#x/IntfRequestLogger';
import { WranglerContext } from '#x/WranglerContext';


/**
 * Logger for HTTP(ish) requests.
 */
export class RequestLogHelper {
  /** @type {IntfRequestLogger} Request logger service to use. */
  #requestLogger;

  /** @type {function(...*)} Underlying logger instance to use. */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {IntfRequestLogger} requestLogger Request logger service to use.
   * @param {?function(...*)} logger Underlying system event logger instance to
   *   use, if any.
   */
  constructor(requestLogger, logger) {
    this.#requestLogger = requestLogger;
    this.#logger        = logger ? logger.req : null;
  }

  /**
   * Logs the indicated request / response pair. This returns the
   * request-specific logger so that it can be used by other parts of the system
   * that are acting in service of the request.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {WranglerContext} context Connection or session context.
   * @returns {function(*...)} The request-specific logger.
   */
  logRequest(req, res, context) {
    const startTime = this.#logger?.$env.nowSec();
    const logger    = this.#logger?.$newId ?? null;
    const requestId = logger?.$meta.lastContext;
    const urlish    = `${req.protocol}://${req.hostname}${req.originalUrl}`;
    const origin    = context.socketAddressPort ?? '<unknown-origin>';
    const method    = req.method;

    const info = {
      connectionId: context.connectionId ?? '<unknown-id>'
    };

    if (context.sessionId) {
      info.sessionId = context.sessionId;
      context.sessionLogger?.newRequest(requestId);
    } else {
      context.connectionLogger?.newRequest(requestId);
    }

    logger?.opened(info);
    logger?.request(origin, req.method, urlish);
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

      const endTime     = this.#logger?.$env.nowSec();
      const elapsedSecs = endTime - startTime;

      logger?.closed({ contentLength, elapsedSecs });

      const requestLogLine = [
        FormatUtils.dateTimeStringFromSecs(Date.now() / 1000, { decimals: 4 }),
        origin,
        method,
        JSON.stringify(urlish),
        res.statusCode,
        FormatUtils.contentLengthString(contentLength),
        FormatUtils.durationStringFromSecs(elapsedSecs, { spaces: false }),
        errorMsg
      ].join(' ');

      logger?.requestLog(requestLogLine);
      this.#requestLogger?.logCompletedRequest(requestLogLine);
    });

    return logger;
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
