// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseStruct } from '@this/data-values';
import { AskIf, MustBe } from '@this/typey';


/**
 * Base class for configuration representation classes. Each concrete subclass
 * is expected to pass a plain object in its `super()` call which is suitable
 * for parsing by the base class. This (base) class defines just one property,
 * `class`, and it is up to each subclass to define other bindings specific to
 * the things-they-are-configuring.
 */
export class BaseConfig extends BaseStruct {
  // @defaultConstructor

  /**
   * Configuration property: The concrete class of the component to create, or
   * `null` if the class is (going to be) implied by context (such as by passing
   * an instance directly to the corresponding component constructor). This
   * property isn't required in general, but it _is_ required if the
   * configuration instance gets used in a context where the concrete component
   * class is not in fact implied.
   *
   * @param {?function(new:object)} [value] Proposed configuration value.
   *   Default `null`;
   * @returns {?function(new:object)} Accepted configuration value.
   */
  _config_class(value = null) {
    if (value === null) {
      return null;
    }

    return MustBe.constructorFunction(value);
  }

  /** @override */
  _impl_propertyPrefix() {
    return 'config';
  }


  //
  // Static members
  //

  /**
   * "Evaluate" a configuration argument that was passed to the constructor of a
   * configurable class. This is where the usual rules (e.g. as described by the
   * `BaseComponent` constructor) are actually implemented. This method is
   * expected to be called on a concrete subclass of this (base) class, and the
   * actual called class is used to drive the salient portion of the error
   * checking.
   *
   * @param {?object} rawConfig Raw configuration object, including allowing
   *   `null` to be equivalent to `{}`, and accepting an instance of this class.
   * @param {object} options Evaluation options.
   * @param {object} [options.defaults] Default values when evaluating a plain
   *   object. Defaults to `{}`.
   * @param {function(new:*)} options.targetClass The class that `rawConfig` is
   *   supposed to be constructing.
   * @returns {BaseConfig} Instance of the concrete class that this method was
   *   called on.
   */
  static eval(rawConfig, { defaults = {}, targetClass }) {
    const configObj = super.eval(rawConfig, {
      defaults: { ...defaults, class: targetClass }
    });

    const configTargetClass = configObj.class;

    if (configTargetClass !== targetClass) {
      if (!AskIf.constructorFunction(configTargetClass)) {
        throw new Error('Expected class (constructor function) for `rawConfig.class`.');
      } else {
        throw new Error(`Mismatch on \`rawConfig.class\`: expected ${targetClass.name}, got ${configTargetClass.name}`);
      }
    }

    return configObj;
  }
}
