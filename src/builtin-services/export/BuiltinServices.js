// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceFactory } from '@this/app-framework';

import { ProcessIdFile } from '#x/ProcessIdFile';
import { ProcessInfoFile } from '#x/ProcessInfoFile';
import { RateLimiter } from '#x/RateLimiter';
import { RequestLogger } from '#x/RequestLogger';
import { SystemLogger } from '#x/SystemLogger';


/**
 * Global control of this module.
 */
export class BuiltinServices {
  /**
   * Registers all the services defined by this module.
   */
  static register() {
    ServiceFactory.register(ProcessIdFile);
    ServiceFactory.register(ProcessInfoFile);
    ServiceFactory.register(RateLimiter);
    ServiceFactory.register(RequestLogger);
    ServiceFactory.register(SystemLogger);
  }
}
