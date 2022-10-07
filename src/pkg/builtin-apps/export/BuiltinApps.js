// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationFactory } from '@this/app-servers';

import { RedirectApplication } from '#x/RedirectApplication';
import { StaticApplication } from '#x/StaticApplication';


/**
 * Global control of this module.
 */
export class BuiltinApps {
  /**
   * Registers all the apps defined by this module.
   */
  static register() {
    ApplicationFactory.register(StaticApplication);
    ApplicationFactory.register(RedirectApplication);
  }
}
