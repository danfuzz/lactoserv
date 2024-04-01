// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { WallClock } from '@this/clocks';
import { IntfRequestLogger } from '@this/net-protocol';
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
  // @defaultConstructor

  /** @override */
  now() {
    return WallClock.now();
  }

  /** @override */
  async requestStarted(networkInfo_unused, timingInfo_unused, request) {
    request.logger?.request(request.infoForLog);
  }

  /** @override */
  async requestEnded(networkInfo, timingInfo, request, response) {
    // Note: This call isn't supposed to `throw`, even if there were errors
    // thrown during handling.
    const resInfo = await response.getInfoForLog(
      networkInfo.nodeResponse, networkInfo.connectionSocket);

    request.logger?.response(resInfo);
    request.logger?.timing(timingInfo);
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // Nothing needed here for this class.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // No need to do anything.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // No need to do anything.
  }


  //
  // Static members
  //

  /** @override */
  static _impl_implementedInterfaces() {
    return [IntfRequestLogger];
  }
}
