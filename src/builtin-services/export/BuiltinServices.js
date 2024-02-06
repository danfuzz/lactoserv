// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseService } from '@this/app-framework';

import { EtagGenerator } from '#x/EtagGenerator';
import { MemoryMonitor } from '#x/MemoryMonitor';
import { ProcessIdFile } from '#x/ProcessIdFile';
import { ProcessInfoFile } from '#x/ProcessInfoFile';
import { RateLimiter } from '#x/RateLimiter';
import { RequestLogger } from '#x/RequestLogger';
import { SystemLogger } from '#x/SystemLogger';


/**
 * Main entrypoint of this module.
 */
export class BuiltinServices {
  /**
   * Gets an array of all the service classes defined by this module.
   *
   * @returns {(function(new:BaseService))[]} Array of all service classes.
   */
  static getAll() {
    return [
      EtagGenerator,
      MemoryMonitor,
      ProcessIdFile,
      ProcessInfoFile,
      RateLimiter,
      RequestLogger,
      SystemLogger
    ];
  }
}
