// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceFactory } from '@this/app-services';

import { AccessLogService } from '#x/AccessLogService';
import { MainLogService } from '#x/MainLogService';

/**
 * Global control of this module.
 */
export class BuiltinServices {
  /**
   * Registers all the apps defined by this module.
   */
  static register() {
    ServiceFactory.register(AccessLogService);
    ServiceFactory.register(MainLogService);
  }
}
