// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreeMap } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';
import { Names } from '#x/Names';
import { RootControlContext } from '#x/RootControlContext';


/**
 * Base class for root components, that is, for components which are meant to be
 * used as the root component for their hierarchies.
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
    // so that we can pass the parsed config to the `RootControlContext`
    // constructor.
    const config = new.target.configClass.eval(rawConfig, {
      targetClass: new.target
    });

    const context = new RootControlContext(config);

    super(config, context);
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

      /**
       * Logging control.
       *
       * @param {?object|TreeMap} [value] Proposed configuration value. Default
       *   `null`.
       * @returns {?TreeMap} Accepted configuration value.
       */
      _config_logging(value = null) {
        if ((value instanceof TreeMap) || (value === null)) {
          return value;
        }

        const result = new TreeMap();
        for (const [k, v] of Object.entries(value)) {
          const path = Names.parsePath(k, true);
          MustBe.boolean(v);
          result.add(path, v);
        }

        return result;
      }

      /**
       * Component name. This is an override of the base class in order to force
       * the name to be non-`null`.
       *
       * @param {string} [value] Proposed configuration value. Default `'root'`.
       * @returns {string} Accepted configuration value.
       */
      _config_name(value = 'root') {
        return Names.mustBeName(value);
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
