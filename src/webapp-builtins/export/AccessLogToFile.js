// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WallClock } from '@this/clocky';
import { ByteCount, Duration, Moment } from '@this/data-values';
import { FileAppender } from '@this/fs-util';
import { IntfAccessLog } from '@this/net-protocol';
import { IncomingRequest } from '@this/net-util';
import { MustBe } from '@this/typey';
import { BaseFileService, Rotator } from '@this/webapp-util';


/**
 * Service which writes an access log to the filesystem in a human-friendly
 * format.
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfAccessLog}
 */
export class AccessLogToFile extends BaseFileService {
  /**
   * File appender.
   *
   * @type {FileAppender}
   */
  #appender;

  /**
   * File rotator to use, if any.
   *
   * @type {?Rotator}
   */
  #rotator = null;

  /**
   * Weak map which keeps track of the start time of requests that have not yet
   * been ended.
   *
   * @type {WeakMap<IncomingRequest, Moment>}
   */
  #startTimes = new WeakMap();

  // @defaultConstructor

  /** @override */
  async _impl_handleEvent_requestStarted(request) {
    this.#startTimes.set(request, this.#now());

    return true;
  }

  /** @override */
  async _impl_handleEvent_requestEnded(request, response, networkInfo) {
    let requestInfo  = null;
    let responseInfo = null;
    try {
      const { connectionSocket, nodeResponse } = networkInfo;
      requestInfo  = request.infoForLog;
      responseInfo = await response.getInfoForLog(nodeResponse, connectionSocket);
    } catch (e) {
      // Shouldn't happen, but if it does, it's better to log and move on than
      // to let the system crash. Note, in particular, these calls (above) are
      // never supposed to throw, even if the handling of the request caused
      // some sort of error to be thrown.
      this.logger?.errorWhileGettingInfo(e);

      if (!requestInfo) {
        requestInfo = {
          method:   '<unknown>',
          origin:   '<unknown>',
          protocol: '<unknown>',
          url:      '<unknown>'
        };
      }

      if (!responseInfo) {
        responseInfo = {
          contentLength: null,
          errorCodes:    ['could-not-get-info'],
          ok:            false,
          statusCode:    599
        };
      }
    }

    const startTime = this.#startTimes.get(request);
    const endTime   = this.#now();
    const duration  = endTime.subtract(startTime);

    this.#startTimes.delete(request);

    const { method, origin, protocol, url }             = requestInfo;
    const { contentLength, errorCodes, ok, statusCode } = responseInfo;

    const codeStr          = ok ? 'ok' : errorCodes.join(',');
    const contentLengthStr = (contentLength === null)
      ? 'no-body'
      : ByteCount.stringFromByteCount(contentLength, { spaces: false });

    const requestLogLine = [
      endTime.toString({ decimals: 4 }),
      origin,
      protocol,
      method,
      this.#urlToLog(url),
      statusCode,
      contentLengthStr,
      duration.toString({ spaces: false }),
      codeStr
    ].join(' ');

    await this.#logLine(requestLogLine);

    return true;
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfAccessLog];
  }

  /** @override */
  async _impl_init() {
    const { config } = this;
    const { bufferPeriod, path, rotate } = config;

    this.#appender = new FileAppender(path, bufferPeriod);
    this.#rotator  = rotate ? new Rotator(config, this.logger) : null;
  }

  /** @override */
  async _impl_start() {
    await this._prot_createDirectoryIfNecessary();
    await this._prot_touchPath();
    await this.#rotator?.start();
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#rotator?.stop(willReload);
  }

  /**
   * Given a full URL-for-logging string, returns the actual string to log,
   * which takes into account the configured maximum length (if any).
   *
   * @param {string} orig The original URL for logging.
   * @returns {string} What to actually log.
   */
  #urlToLog(orig) {
    const { maxUrlLength } = this.config;

    if (!maxUrlLength) {
      return orig;
    }

    const len = orig.length;

    if (len <= maxUrlLength) {
      return orig;
    }

    const prefix = orig.slice(0, Math.floor((maxUrlLength - 3) / 2));
    const suffix = orig.slice(len - (maxUrlLength - prefix.length - 3));
    return `${prefix}...${suffix}`;
  }

  /**
   * Logs a complete reqeust/response line.
   *
   * @param {string} line The line to log.
   */
  async #logLine(line) {
    await this.#appender.appendText(line, true);
  }

  /**
   * Gets the current time, as far as this instance is concerned. This method
   * exists to make it easier to refine our idea of time in this class without
   * having to change both places that need figure out when "now" is.
   *
   * @returns {Moment} "Now."
   */
  #now() {
    return WallClock.now();
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseFileService.Config {
    /**
     * How long to buffer updates for, or `null` to not do any buffering. If
     * passed as a string, it is parsed by {@link Duration#parse}.
     *
     * @param {?string|Duration} value Proposed configuration value. Default
     *   `null`.
     * @returns {?Duration} Accepted configuration value.
     */
    _config_bufferPeriod(value = null) {
      const result = Duration.parse(value, { range: { minInclusive: 0 } });

      if (!result) {
        throw new Error(`Could not parse \`bufferPeriod\`: ${value}`);
      }

      return (result === 0) ? null : result;
    }

    /**
     * Maximum rendered URL length, or `null` for no maximum.
     *
     * @param {?number} value Proposed configuration value. Default `null`.
     * @returns {?number} Accepted configuration value.
     */
    _config_maxUrlLength(value = null) {
      return (value === null)
        ? null
        : MustBe.number(value, { safeInteger: true, minInclusive: 20 });
    }
  };
}
