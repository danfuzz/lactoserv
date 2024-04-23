// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseAggregateComponent, BaseConfig } from '@this/compy';


/**
 * Minimal concrete component class, which has no-op implementations for all
 * `_impl_*` methods.
 */
export class NopComponent extends BaseAggregateComponent {
  // @defaultConstructor

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return BaseConfig;
  }
}
