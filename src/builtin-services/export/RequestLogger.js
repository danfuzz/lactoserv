// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocks';
import { FormatUtils, IntfLogger } from '@this/loggy-intf';
import { IntfRequestLogger } from '@this/net-protocol';
import { OutgoingResponse } from '@this/net-util';
import { FileServiceConfig } from '@this/sys-config';
import { BaseFileService, Rotator } from '@this/sys-util';


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

  /**
   * Constructs an instance.
   *
   * @param {FileServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#rotator = config.rotate ? new Rotator(config, this.logger) : null;
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
  async requestStarted(networkInfo_unused, timingInfo_unused, request_unused) {
    // This class does not do start-of-request logging.
  }

  /** @override */
  async requestEnded(networkInfo, timingInfo, request, response_unused) {
    const { method, origin, protocol, url }  = request.getLoggableRequestInfo();
    const { duration, end }                  = timingInfo;
    const { connectionSocket, nodeResponse } = networkInfo;

    // Note: The call to `getLoggableResponseInfo()` isn't supposed to `throw`,
    // even if there were errors thrown during handling.
    const { contentLength, errorCodes, ok, statusCode } =
      await OutgoingResponse.getLoggableResponseInfo(nodeResponse, connectionSocket);

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
    return FileServiceConfig;
  }
}
