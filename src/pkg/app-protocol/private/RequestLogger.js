// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as http2 from 'node:http2';
import * as process from 'node:process';

import * as express from 'express';

import { FormatUtils } from '@this/loggy';


/**
 * Logger for HTTP(ish) requests.
 */
export class RequestLogger {
  /** @type {function(...*)} Underlying logger instance to use. */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {function(...*)} logger Underlying logger instance to use.
   */
  constructor(logger) {
    this.#logger = logger.req;
  }

  /**
   * Logs the indicated request / response pair. This returns the
   * request-specific logger so that it can be used by other parts of the system
   * that are acting in service of the request.
   *
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @returns {function(*...)} The request-specific logger.
   */
  logRequest(req, res) {
    const timeStart  = process.hrtime.bigint();
    const logger     = this.#logger.$newId;
    const reqHeaders = req.headers;
    const urlish     = `${req.protocol}://${req.hostname}${req.originalUrl}`;
    const origin     =
      FormatUtils.addressPortString(req.socket.remoteAddress, req.socket.remotePort);

    logger.started(origin, req.method, urlish);
    logger.headers(RequestLogger.#sanitizeRequestHeaders(reqHeaders));

    const cookies = req.cookies;
    if (cookies) {
      logger.cookies(cookies);
    }

    res.on('finish', () => {
      const resHeaders    = res.getHeaders();
      const contentLength = resHeaders['content-length'] ?? null;
      logger.response(res.statusCode,
        RequestLogger.#sanitizeResponseHeaders(resHeaders));

      const timeEnd = process.hrtime.bigint();
      const elapsedMsec = Number(timeEnd - timeStart) * RequestLogger.#NSEC_PER_MSEC;
      logger.done({ contentLength, elapsedMsec });

      const accessLogLine = [
        FormatUtils.dateTimeString(Date.now() / 1000),
        origin,
        req.method,
        JSON.stringify(urlish),
        FormatUtils.contentLengthString(contentLength),
        FormatUtils.elapsedTimeString(elapsedMsec),
      ].join(' ');
      logger.accessLog(accessLogLine);
    });

    return logger;
  }


  //
  // Static members
  //

  /** @type {number} The number of nanoseconds in a millisecond. */
  static #NSEC_PER_MSEC = 1 / 1_000_000;

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
