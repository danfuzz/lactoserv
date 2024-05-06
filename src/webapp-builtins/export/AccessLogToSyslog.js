// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfAccessLog } from '@this/net-protocol';
import { BaseService } from '@this/webapp-core';


/**
 * Service which writes access log info to the system log (which itself might in
 * turn get output in one or more forms).
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfAccessLog}
 */
export class AccessLogToSyslog extends BaseService {
  // @defaultConstructor

  /** @override */
  async _impl_handleEvent_requestStarted(request) {
    request.logger?.request(request.infoForLog);

    return true;
  }

  /** @override */
  async _impl_handleEvent_requestEnded(request, response, networkInfo) {
    try {
      const { connectionSocket, nodeResponse } = networkInfo;
      const responseInfo = await response.getInfoForLog(nodeResponse, connectionSocket);

      request.logger?.response(responseInfo);
    } catch (e) {
      // Shouldn't happen, but if it does, it's better to log and move on than
      // to let the system crash. Note, in particular, the call to
      // `getInfoForLog()` (above) is never supposed to throw, even if the
      // request or response caused some sort of error to be thrown.
      this.logger?.errorWhileLoggingRequest(e);
    }

    return true;
  }

  /** @override */
  _impl_implementedInterfaces() {
    return [IntfAccessLog];
  }

  /** @override */
  async _impl_start() {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }
}
