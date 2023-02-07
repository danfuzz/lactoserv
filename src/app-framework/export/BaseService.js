// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Instance-specific logger, or `null` if no
   *   logging is to be done.
   */
  constructor(config, logger) {
    MustBe.instanceOf(config, ServiceConfig);

    super(config, logger);
  }
}
