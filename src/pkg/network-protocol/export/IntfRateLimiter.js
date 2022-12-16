// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

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
   * @param {?function(*)} logger Logger to use for this action.
   * @returns {boolean} Was a connection actually granted?
   */
  async newConnection(logger) {
    Methods.abstract(logger);
  }

  /**
   * Waits if necessary, and async-returns when either the caller has been
   * granted a new request or there is too much load to grant a request.
   *
   * @abstract
   * @param {?function(*)} logger Logger to use for this action.
   * @returns {boolean} Was a request actually granted?
   */
  async newRequest(logger) {
    Methods.abstract(logger);
  }

  /**
   * Wraps a writable stream in a new writable stream, the latter which abides
   * by this instance's data rate limiter. If the given stream is actually
   * duplex, then this method returns a duplex stream but with the read side
   * being fully pass-through.
   *
   * @abstract
   * @param {object} stream The writable stream to wrap.
   * @param {?function(*)} logger Logger to use for this action.
   * @returns {object} An appropriately-wrapped instance, or the original
   *   `stream` if this instance has no data rate limiter.
   */
  wrapWriter(stream, logger) {
    Methods.abstract(stream, logger);
  }
}
