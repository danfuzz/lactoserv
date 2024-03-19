// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
import { FormatUtils, IntfLogger } from '@this/loggy-intf';
import { IntfRequestLogger } from '@this/net-protocol';
import { OutgoingResponse } from '@this/net-util';
import { FileServiceConfig } from '@this/sys-config';
import { BaseFileService, Rotator } from '@this/sys-util';
import { MustBe } from '@this/typey';


/**
 * Service which writes the request/response log to the filesystem.
 *
 * See `doc/configuration.md` for configuration object details.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestLogger extends BaseFileService {
  /** @type {?Rotator} File rotator to use, if any. */
  #rotator;

  /** @type {boolean} Also log to the system log? */
  #doSyslog;

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#rotator  = config.rotate ? new Rotator(config, this.logger) : null;
    this.#doSyslog = config.doSyslog;
  }

  /** @override */
  async logCompletedRequest(line) {
    await this.#logLine(line);
  }

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async requestStarted(networkInfo_unused, timingInfo_unused, request) {
    if (this.#doSyslog) {
      request.logger?.request(request.getLoggableRequestInfo());
    }
  }

  /** @override */
  async requestEnded(networkInfo, timingInfo, request, response_unused) {
    // Note: This call isn't ever supposed to `throw`, even if there were errors
    // thrown during request/response handling.
    const { connectionSocket, nodeResponse } = networkInfo;
    const responseInfo =
      await OutgoingResponse.getLoggableResponseInfo(nodeResponse, connectionSocket);

    if (this.#doSyslog) {
      request.logger?.response(responseInfo);
      request.logger?.timing(timingInfo);
    }

    const { method, origin, protocol, url }             = request.getLoggableRequestInfo();
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
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends FileServiceConfig {
    /** @type {boolean} Also log to the system log? */
    #doSyslog;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const { sendToSystemLog = false } = config;

      this.#doSyslog = MustBe.boolean(sendToSystemLog);
    }

    /** @returns {boolean} Also log to the system log? */
    get doSyslog() {
      return this.#doSyslog;
    }
  };
}
