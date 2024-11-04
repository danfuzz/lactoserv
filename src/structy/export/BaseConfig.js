// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf, MustBe } from '@this/typey';

import { BaseStruct } from '#x/BaseStruct';


/**
 * Base class for configuration representation classes. Each concrete subclass
 * is expected to pass a plain object in its `super()` call which is suitable
 * for parsing by the base class. This (base) class defines just one property,
 * `class`, and it is up to each subclass to define other bindings specific to
 * the things-they-are-configuring.
 *
 * Instances of concrete subclasses of this class are meant to be associated
 * with classes to be configured, and specifically for those classes to accept
 * instances of this class in their constructor. See {@link #eval} for more
 * info.
 */
export class BaseConfig extends BaseStruct {
  // @defaultConstructor

  /**
   * The concrete class which is to be constructed by this instance, or `null`
   * if the class is (going to be) implied by context (such as by passing an
   * instance directly to the corresponding component constructor). This
   * property isn't required in general, but it _is_ required if the
   * configuration instance gets used in a context where the concrete component
   * class is not in fact implied.
   *
   * @param {?function(new:object)} [value] Proposed configuration value.
   *   Default `null`;
   * @returns {?function(new:object)} Accepted configuration value.
   */
  _config_class(value = null) {
    return (value === null)
      ? null
      : MustBe.constructorFunction(value);
  }

  /** @override */
  _impl_propertyPrefix() {
    return 'config';
  }


  //
  // Static members
  //

  /**
   * Similar to {@link BaseStruct#eval}, except specifically for configuration
   * objects. This is particularly useful when used to process a configuration
   * argument to a constructor. (See, for example, `compy.BaseComponent`.)
   *
   * @param {?object} rawConfig Raw configuration object, including allowing
   *   `null` to be equivalent to `{}`, and accepting an instance of this class.
   * @param {object} options Evaluation options.
   * @param {object} [options.defaults] Default values when evaluating a plain
   *   object. Defaults to `{}`.
   * @param {?function(new:*)} options.targetClass The class that `rawConfig` is
   *   supposed to be constructing, or `null` if the class-to-be-constructed is
   *   ultimately going to be implied by context. This becomes the `class`
   *   property of the constructed instance of _this_ (concrete) class.
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
