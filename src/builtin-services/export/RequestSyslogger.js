// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WallClock } from '@this/clocks';
import { IntfRequestLogger } from '@this/net-protocol';
import { OutgoingResponse } from '@this/net-util';
import { BaseService } from '@this/sys-framework';


/**
 * Service which writes the request/response log to the system log (which itself
 * might in turn be written to several possible locations).
 *
 * See `doc/configuration.md` for configuration object details.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestSyslogger extends BaseService {
  // Note: The default constructor is fine for this class.

  /** @override */
  async logCompletedRequest(line_unused) {
    // TODO: Remove this method.
  }

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async requestStarted(networkInfo_unused, timingInfo_unused, request) {
    request.logger?.request(request.getLoggableRequestInfo());
  }

  /** @override */
  async requestEnded(networkInfo, timingInfo, request, response_unused) {
    // Note: This call isn't supposed to `throw`, even if there were errors
    // thrown during handling.
    const resInfo = await OutgoingResponse.getLoggableResponseInfo(
      networkInfo.nodeResponse, networkInfo.connectionSocket);

    request.logger?.response(resInfo);
    request.logger?.timing(timingInfo);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // No need to do anything.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // No need to do anything.
  }
}
