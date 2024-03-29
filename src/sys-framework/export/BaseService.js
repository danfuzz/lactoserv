// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseNamedComponent } from '@this/compote';
import { ServiceConfig } from '@this/sys-config';


/**
 * Base class for system services.
 */
export class BaseService extends BaseNamedComponent {
  // @defaultConstructor


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return ServiceConfig;
  }
}
