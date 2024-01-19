// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Moment } from '@this/data-values';
import { Methods } from '@this/typey';


/**
 * Interface for (HTTP-ish) request loggers, as used by this module.
 *
 * @interface
 */
export class IntfRequestLogger {
  /**
   * Gets this instance's idea of what the current time is.
   *
   * @returns {Moment} The current time.
   */
  now() {
    return Methods.abstract();
  }

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
