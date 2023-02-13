// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseService, ServiceFactory } from '@this/app-framework';

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
      ProcessIdFile,
      ProcessInfoFile,
      RateLimiter,
      RequestLogger,
      SystemLogger
    ];
  }

  /**
   * Registers all the services defined by this module.
   */
  static register() {
    for (const cls of this.getAll()) {
      ServiceFactory.register(cls);
    }
  }
}
