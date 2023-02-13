// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationFactory } from '@this/app-framework';

import { Redirector } from '#x/Redirector';
import { StaticFiles } from '#x/StaticFiles';


/**
 * Global control of this module.
 */
export class BuiltinApplications {
  /**
   * Registers all the applications defined by this module.
   */
  static register() {
    ApplicationFactory.register(StaticFiles);
    ApplicationFactory.register(Redirector);
  }
}
