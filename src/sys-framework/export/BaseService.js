// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy';
import { ServiceConfig } from '@this/sys-config';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return ServiceConfig;
  }
}
