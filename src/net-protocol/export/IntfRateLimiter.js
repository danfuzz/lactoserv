// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';


/**
 * Interface for rate limiters, as used by this module.
 *
 * @interface
 */
export class IntfRateLimiter {
  /**
   * Waits if necessary, and async-returns when either the caller has been
   * granted a new connection or there is too much load to grant a connection.
   *
   * @abstract
   * @param {?IntfLogger} logger Logger to use for this action.
   * @returns {boolean} Was a connection actually granted?
   */
  async _impl_handleCall_newConnection(logger) {
    Methods.abstract(logger);
  }

  /**
   * Waits if necessary, and async-returns when either the caller has been
   * granted a new request or there is too much load to grant a request.
   *
   * @abstract
   * @param {?IntfLogger} logger Logger to use for this action.
   * @returns {boolean} Was a request actually granted?
   */
  async _impl_handleCall_newRequest(logger) {
    Methods.abstract(logger);
  }
}
