// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as http2 from 'node:http2';
import * as process from 'node:process';

import * as express from 'express';

import { LogRecord } from '@this/loggy';


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
      RequestLogger.addressPortString(req.socket.remoteAddress, req.socket.remotePort);

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
        LogRecord.dateTimeString(Date.now() / 1000),
        origin,
        req.method,
        JSON.stringify(urlish),
        RequestLogger.#contentLengthString(contentLength),
        RequestLogger.#elapsedTimeString(elapsedMsec),
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
   * Makes a human-friendly network address/port string.
   *
   * @param {string} address The address.
   * @param {number} port The port.
   * @returns {string} The friendly form.
   */
  static addressPortString(address, port) {
    if (/:/.test(address)) {
      // IPv6 form.
      return `[${address}]:${port}`;
    } else {
      // IPv4 form.
      return `${address}:${port}`;
    }
  }

  /**
   * Makes a human-friendly content length string.
   *
   * @param {?number} contentLength The content length.
   * @returns {string} The friendly form.
   */
  static #contentLengthString(contentLength) {
    if (contentLength === null) {
      return '<unknown-length>';
    } else if (contentLength < 1024) {
      return `${contentLength}B`;
    } else if (contentLength < (1024 * 1024)) {
      const kilobytes = (contentLength / 1024).toFixed(2);
      return `${kilobytes}kB`;
    } else {
      const megabytes = (contentLength / 1024 / 1024).toFixed(2);
      return `${megabytes}MB`;
    }
  }

  /**
   * Makes a human-friendly elapsed time string.
   *
   * @param {number} elapsedMsec The elapsed time in msec.
   * @returns {string} The friendly form.
   */
  static #elapsedTimeString(elapsedMsec) {
    if (elapsedMsec < 10) {
      const msec = elapsedMsec.toFixed(2);
      return `${msec}msec`;
    } else if (elapsedMsec < 1000) {
      const msec = elapsedMsec.toFixed(0);
      return `${msec}msec`;
    } else {
      const sec = (elapsedMsec / 1000).toFixed(1);
      return `${sec}sec`;
    }
  }

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
