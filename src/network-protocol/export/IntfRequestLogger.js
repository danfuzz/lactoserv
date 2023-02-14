// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
