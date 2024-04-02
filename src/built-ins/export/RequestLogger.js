// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
import { Moment } from '@this/data-values';
import { FormatUtils } from '@this/loggy-intf';
import { IncomingRequest } from '@this/net-util';
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
  async requestStarted(request, networkInfo) {
    const startTime = this.#now();

    if (this.config.doSyslog) {
      request.logger?.request(request.infoForLog);
    }

    // Call `requestEnded()`, but don't `await` it, because we want to promptly
    // indicate to our caller that we did in fact handle the service event.
    this.#logWhenRequestEnds(request, networkInfo, startTime);

    return true;
  }

  /** @override */
  async requestEnded(request, response, networkInfo) {
    // TODO: Remove this method.
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
   * Waits for the request to end, and then logs information about it.
   *
   * @param {IncomingRequest} request The incoming request.
   * @param {object} networkInfo Miscellaneous network-ish info.
   * @param {Moment} startTime The start time of the request.
   */
  async #logWhenRequestEnds(request, networkInfo, startTime) {
    // Note: Nothing will catch errors thrown from this method. (See call site
    // above.)

    try {
      const { connectionSocket, nodeResponse, responsePromise } = networkInfo;
      const response     = await responsePromise;
      const responseInfo = await response.getInfoForLog(nodeResponse, connectionSocket);

      const endTime    = this.#now();
      const timingInfo = {
        start:    startTime,
        end:      endTime,
        duration: endTime.subtract(startTime)
      };

      if (this.config.doSyslog) {
        request.logger?.response(responseInfo);
        request.logger?.timing(timingInfo);
      }

      const { method, origin, protocol, url }             = request.infoForLog;
      const { duration, end }                             = timingInfo;
      const { contentLength, errorCodes, ok, statusCode } = responseInfo;

      const codeStr          = ok ? 'ok' : errorCodes.join(',');
      const contentLengthStr = (contentLength === null)
        ? 'no-body'
        : FormatUtils.byteCountString(contentLength, { spaces: false });

      const requestLogLine = [
        end.toString({ decimals: 4 }),
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
    } catch (e) {
      // Shouldn't happen, but if it does, it's better to log and move on than
      // to let the system crash. Note, in particular, the call to
      // `getInfoForLog()` (above) is never supposed to throw, even if the
      // request or response caused some sort of error to be thrown.
      this.logger?.errorWhileLoggingRequest(e);
    }
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
