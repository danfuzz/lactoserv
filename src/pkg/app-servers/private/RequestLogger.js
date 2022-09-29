// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import * as http2 from 'node:http2';
import * as process from 'node:process';


/**
 * Logger for HTTP(ish) requests.
 */
export class RequestLogger {
  /** @type {function(...*)} Underlying logger instance to use. */
  #logger;

  /** @type {number} "Minute number," for making request IDs. */
  #minuteNumber = -1;

  /** @type {number} Sequence number, for making request IDs. */
  #sequenceNumber = 0;

  /**
   * Constructs an instance.
   *
   * @param {function(...*)} logger Underlying logger instance to use.
   */
  constructor(logger) {
    this.#logger = logger;
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
    const logger     = this.#logger[this.#makeRequestId()];
    const reqHeaders = req.headers;

    logger.started(req.method, req.protocol, req.hostname, req.originalUrl);
    logger.origin(req.socket.remoteAddress);
    logger.headers(RequestLogger.#sanitizeRequestHeaders(reqHeaders));

    const cookies = req.cookies;
    if (cookies) {
      logger.cookies(cookies);
    }

    res.on('finish', () => {
      const resLogger  = logger.res;
      const resHeaders = res.getHeaders();
      resLogger.code(res.statusCode);
      resLogger.headers(RequestLogger.#sanitizeResponseHeaders(resHeaders));

      const timeEnd = process.hrtime.bigint();
      const elapsedMsec = Number(timeEnd - timeStart) * RequestLogger.#NSEC_PER_MSEC;
      logger.done(Math.trunc(elapsedMsec), 'msec');
    });

    return logger;
  }

  /**
   * Makes a new unique (at least unique _enough_) request ID, for use with a
   * single request.
   *
   * The format of the ID is `MMMMM-NNNN`, where both halves are lowercase
   * hexadecimal, with `MMMMM` being a representation of the "current minute"
   * (wraps around every couple years or so) and `NNNN` being the request number
   * within that minute (four digits by default but will expand if necessary).
   *
   * @returns {string} An appropriately-constructed request ID.
   */
  #makeRequestId() {
    const minuteNumber =
      Math.trunc(Date.now() * RequestLogger.#MINS_PER_MSEC) & 0xfffff;

    if (minuteNumber !== this.#minuteNumber) {
      this.#minuteNumber   = minuteNumber;
      this.#sequenceNumber = 0;
    }

    const sequenceNumber = this.#sequenceNumber;
    this.#sequenceNumber++;

    const minStr = minuteNumber.toString(16).padStart(5, '0');
    const seqStr = (sequenceNumber < 0x10000)
      ? sequenceNumber.toString(16).padStart(4, '0')
      : sequenceNumber.toString(16).padStart(8, '0');

    return `${minStr}-${seqStr}`;
  }


  //
  // Static members
  //

  /** @type {number} The number of minutes in a millisecond. */
  static #MINS_PER_MSEC = 1 / (1000 * 60);

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

    delete result[http2.sensitiveHeaders]
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
