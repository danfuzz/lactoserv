// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceFactory } from '@this/app-services';

import { RequestLoggerService } from '#x/RequestLoggerService';
import { SystemLoggerService } from '#x/SystemLoggerService';


/**
 * Global control of this module.
 */
export class BuiltinServices {
  /**
   * Registers all the apps defined by this module.
   */
  static register() {
    ServiceFactory.register(RequestLoggerService);
    ServiceFactory.register(SystemLoggerService);
  }
}
