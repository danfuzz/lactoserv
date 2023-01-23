// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceFactory } from '@this/app-framework';

import { ProcessIdFileService } from '#x/ProcessIdFileService';
import { ProcessInfoFileService } from '#x/ProcessInfoFileService';
import { RateLimiterService } from '#x/RateLimiterService';
import { RequestLoggerService } from '#x/RequestLoggerService';
import { SystemLoggerService } from '#x/SystemLoggerService';


/**
 * Global control of this module.
 */
export class BuiltinServices {
  /**
   * Registers all the services defined by this module.
   */
  static register() {
    ServiceFactory.register(ProcessIdFileService);
    ServiceFactory.register(ProcessInfoFileService);
    ServiceFactory.register(RateLimiterService);
    ServiceFactory.register(RequestLoggerService);
    ServiceFactory.register(SystemLoggerService);
  }
}
