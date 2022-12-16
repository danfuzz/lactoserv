// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import { ApplicationFactory } from '@this/app-servers';

import { RedirectApplication } from '#x/RedirectApplication';
import { StaticApplication } from '#x/StaticApplication';


/**
 * Global control of this module.
 */
export class BuiltinApplications {
  /**
   * Registers all the applications defined by this module.
   */
  static register() {
    ApplicationFactory.register(StaticApplication);
    ApplicationFactory.register(RedirectApplication);
  }
}
