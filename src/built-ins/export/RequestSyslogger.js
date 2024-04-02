// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfRequestLogger } from '@this/net-protocol';
import { IncomingRequest } from '@this/net-util';
import { BaseService } from '@this/sys-framework';


/**
 * Service which writes the request/response log to the system log (which itself
 * might in turn be written to several possible locations).
 *
 * See `doc/configuration` for configuration object details.
 *
 * @implements {IntfRequestLogger}
 */
export class RequestSyslogger extends BaseService {
  // @defaultConstructor

  /** @override */
  async requestStarted(networkInfo, request) {
    request.logger?.request(request.infoForLog);

    // Call `requestEnded()`, but don't `await` it, because we want to promptly
    // indicate to our caller that we did in fact handle the service event.
    this.#logWhenRequestEnds(request, networkInfo);

    return true;
  }

  /** @override */
  async requestEnded(networkInfo, request, response) {
    // TODO: Remove this method.
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

  /**
   * Waits for the request to end, and then logs information about it.
   *
   * @param {IncomingRequest} request The incoming request.
   * @param {object} networkInfo Miscellaneous network-ish info.
   */
  async #logWhenRequestEnds(request, networkInfo) {
    // Note: Nothing will catch errors thrown from this method. (See call site
    // above.)

    try {
      const { connectionSocket, nodeResponse, responsePromise } = networkInfo;
      const response     = await responsePromise;
      const responseInfo = await response.getInfoForLog(nodeResponse, connectionSocket);

      request.logger?.response(responseInfo);
    } catch (e) {
      // Shouldn't happen, but if it does, it's better to log and move on than
      // to let the system crash. Note, in particular, the call to
      // `getInfoForLog()` (above) is never supposed to throw, even if the
      // request or response caused some sort of error to be thrown.
      this.logger?.errorWhileLoggingRequest(e);
    }
  }

  //
  // Static members
  //

  /** @override */
  static _impl_implementedInterfaces() {
    return [IntfRequestLogger];
  }
}
