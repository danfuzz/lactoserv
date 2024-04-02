// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
import { Moment } from '@this/data-values';
import { FormatUtils } from '@this/loggy-intf';
import { IntfRequestLogger } from '@this/net-protocol';
import { BaseFileService, Rotator } from '@this/sys-util';
import { MustBe } from '@this/typey';


/**
 * Service which writes the request/response log to the filesystem.
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestLogger extends BaseFileService {
  /**
   * File rotator to use, if any.
   *
   * @type {?Rotator}
   */
  #rotator = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleEvent_requestStarted(request) {
    request[RequestLogger.#SYM_startTime] = this.#now();

    if (this.config.doSyslog) {
      request.logger?.request(request.infoForLog);
    }

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

    const startTime = request[RequestLogger.#SYM_startTime];
    const endTime   = this.#now();
    const duration  = endTime.subtract(startTime);

    if (this.config.doSyslog) {
      request.logger?.response(responseInfo);
    }

    const { method, origin, protocol, url }             = requestInfo;
    const { contentLength, errorCodes, ok, statusCode } = responseInfo;

    const codeStr          = ok ? 'ok' : errorCodes.join(',');
    const contentLengthStr = (contentLength === null)
      ? 'no-body'
      : FormatUtils.byteCountString(contentLength, { spaces: false });

    const requestLogLine = [
      endTime.toString({ decimals: 4 }),
      origin,
      protocol,
      method,
      url,
      statusCode,
      contentLengthStr,
      duration.toString({ spaces: false }),
      codeStr
    ].join(' ');

    await this.#logLine(requestLogLine);

    return true;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    const { config } = this;
    this.#rotator = config.rotate ? new Rotator(config, this.logger) : null;
  }

  /** @override */
  async _impl_start(isReload) {
    await this._prot_createDirectoryIfNecessary();
    await this._prot_touchPath();
    await this.#rotator?.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#rotator?.stop(willReload);
  }

  /**
   * Logs a complete reqeust/response line.
   *
   * @param {string} line The line to log.
   */
  async #logLine(line) {
    await fs.appendFile(this.config.path, `${line}\n`);
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

  /**
   * Symbol name for private property added to request objects, to record the
   * start time.
   *
   * @type {symbol}
   */
  static #SYM_startTime = Symbol('RequestLogger.startTime');

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /** @override */
  static _impl_implementedInterfaces() {
    return [IntfRequestLogger];
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseFileService.Config {
    /**
     * Also log to the system log?
     *
     * @type {boolean}
     */
    #doSyslog;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { sendToSystemLog = false } = rawConfig;

      this.#doSyslog = MustBe.boolean(sendToSystemLog);
    }

    /** @returns {boolean} Also log to the system log? */
    get doSyslog() {
      return this.#doSyslog;
    }
  };
}
