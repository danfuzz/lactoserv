// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { AskIf } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';
import { Names } from '#x/Names';
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
    // We need to recapitulate the config parsing our superclass would have done
    // so that we will only get a valid `rootLogger` value. (That is, if we're
    // passed a bogus `rawConfig`, the `eval()` call will throw.)
    const configClass = new.target.CONFIG_CLASS;
    rawConfig = configClass.eval(rawConfig, {
      targetClass: new.target
    });

    const context = new RootControlContext(rawConfig.rootLogger);

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
       * Component name. This is an override of the base class in order to
       * force the name to be non-`null`.
       *
       * @param {string} [value] Proposed configuration value. Default `'root'`.
       * @returns {string} Accepted configuration value.
       */
      _config_name(value = 'root') {
         return Names.checkName(value);
      }

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
