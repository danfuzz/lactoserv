// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseNamedComponent } from '@this/sys-compote';
import { ServiceConfig } from '@this/sys-config';


/**
 * Base class for system services.
 */
export class BaseService extends BaseNamedComponent {
  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   */
  constructor(config) {
    super(config);
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return ServiceConfig;
  }
}
