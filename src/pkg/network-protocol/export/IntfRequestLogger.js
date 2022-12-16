// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Methods } from '@this/typey';


/**
 * Interface for (HTTP-ish) request loggers, as used by this module.
 *
 * @interface
 */
export class IntfRequestLogger {
  /**
   * Logs a completed request.
   *
   * @abstract
   * @param {string} line Line representing the completed request.
   */
  async logCompletedRequest(line) {
    Methods.abstract(line);
  }
}
