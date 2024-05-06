// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { AskIf } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';
import { RootControlContext } from '#x/RootControlContext';


/**
 * Base class for root components, that is, for components which are meant
 * to be used as the root component for their hierarchies.
 *
 * TODO: This class doesn't actually do anything... yet.
 *
 * @returns {function(new:*)} The instantiated template class.
 */
export class BaseRootComponent extends BaseComponent {
  /**
   * Constructs an instance. Unlike most component constructors, this one calls
   * the `super`-constructor with a non-`null` value for the second argument
   * (the `RootControlContext`), which it constructs itself. Concrete subclasses
   * are simply responsible for providing an appropriate value for the
   * `rootLogger` configuration.
   *
   * @param {?object} [rawConfig] "Raw" (not guaranteed to be parsed and
   *   correct) configuration for this instance. Default `null`.
   */
  constructor(rawConfig = null) {
    if ((rawConfig === null) || AskIf.plainObject(rawConfig)) {
      // Set up defaults.
      rawConfig = {
        name: 'root',
        rootLogger: null, // Should not be necessary. TODO: Fix!
        ...rawConfig
      };
    }

    // TODO: Fix the use of the config here!
    const context = new RootControlContext(rawConfig.rootLogger ?? null);

    super(rawConfig, context);
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      // @defaultConstructor

      /**
       * Root logger to use, or `null` if the component hierarchy will not do
       * logging at all (at least not using the usual mechanism).
       *
       * @param {?IntfLogger} [value] Proposed configuration value. Default
       *   `null`.
       * @returns {?IntfLogger} Accepted configuration value.
       */
      _config_rootLogger(value = null) {
        if (value === null) {
          return value;
        } else if (typeof value !== 'function') {
          throw new Error('Invalid value for `rootLogger`.');
        }

        // TODO: Check for actual interface implementation.
        return value;
      }
    };
  }
};
