// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseClassedConfig, BaseComponent } from '@this/compote';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  // @defaultConstructor

  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return BaseService.Config;
  }

  /**
   * Default configuration subclass for this (outer) class, which adds no
   * options beyond `class`.
   *
   * This class only really exists to be an easy target to use when subclasses
   * want to define configuration classes in the usual way, without having to
   * remember the persnickety detail of which actual class in the `compote`
   * module is the most appropriate one to derive from.
   */
  static Config = class Config extends BaseClassedConfig {
    // @defaultConstructor
  };
}
