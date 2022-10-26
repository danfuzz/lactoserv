// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

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
