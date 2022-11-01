// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceFactory } from '@this/app-services';

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
    ServiceFactory.register(ProcessInfoFileService);
    ServiceFactory.register(RateLimiterService);
    ServiceFactory.register(RequestLoggerService);
    ServiceFactory.register(SystemLoggerService);
  }
}
