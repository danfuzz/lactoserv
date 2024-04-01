// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
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
  now() {
    return WallClock.now();
  }

  /** @override */
  async requestStarted(networkInfo_unused, timingInfo_unused, request) {
    if (this.config.doSyslog) {
      request.logger?.request(request.infoForLog);
    }
  }

  /** @override */
  async requestEnded(networkInfo, timingInfo, request, response) {
    // Note: This call isn't ever supposed to `throw`, even if there were errors
    // thrown during request/response handling.
    const { connectionSocket, nodeResponse } = networkInfo;
    const responseInfo = await response.getInfoForLog(nodeResponse, connectionSocket);

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
