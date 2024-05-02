// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { Names } from '#x/Names';


/**
 * Base class for configuration representation classes. Each concrete subclass
 * is expected to pass a plain object in its `super()` call which is suitable
 * for parsing by the base class. This (base) class defines a small handful of
 * core bindings, and it is up to each subclass to define other bindings
 * specific to the things-they-are-configuring.
 */
export class BaseConfig {
  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    MustBe.plainObject(rawConfig);

    this.#fillInObject(rawConfig);
  }

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

  /**
   * Configuration property: The item's name, or `null` if it does not have a
   * configured name. If `null`, the corresponding component will get a
   * synthesized name as soon as it is attached to a hierarchy. If non-`null`,
   * it must adhere to the syntax defined by {@link Names#checkName}. Names are
   * used when finding a component in its hierarchy, and for use when logging.
   *
   * @param {?string} [value] Proposed configuration value. Default `null`.
   * @returns {?string} Accepted configuration value.
   */
  _config_name(value = null) {
    if (value === null) {
      return null;
    }

    return Names.checkName(value);
  }

  /**
   * Validates a processed configuration object, optionally changing properties,
   * prior to actually setting its properties on this instance. Subclasses
   * should override this if they need to do any final validation or tweakage.
   * The base class implementation of this method returns its argument (that is,
   * it does nothing), but concrete subclasses should check their own immediate
   * superclasses for requirements about calling `super()`.
   *
   * @param {object} config Processed configuration object.
   * @returns {object} Final configuration object to use for setting properties
   *   on `this`.
   */
  _impl_validate(config) {
    return config;
  }

  /**
   * Fills in a property on `this` for each property that is covered by a
   * `_config_*` method defined by the actual (concrete) class of `this`. If the
   * given `rawConfig` doesn't have a property for any given checker method,
   * that method is called with no argument, to give it a chance to use a
   * default value or simply reject it for not being filled in. After making all
   * such calls, this method then calls {@link #_impl_validate} to allow the
   * concrete subclass to do any final validation and tweakage.
   *
   * **Note:** This method treats `undefined` in configuration objects like
   * `null` and will only pass `null` per se into a checker method. And it
   * throws an error if a checker returns `undefined`, on the assumption that it
   * is missing an explicit `return`.
   *
   * **Note:** For the sake of determinism, this method calls checker methods in
   * Unicode sort order.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  #fillInObject(rawConfig) {
    const checkers    = this.#findConfigCheckers();
    const sortedNames = [...checkers.keys()].sort();
    const props       = {};
    const leftovers   = new Set(Object.keys(rawConfig));

    for (const name of sortedNames) {
      const checker   = checkers.get(name);
      const hasConfig = name in rawConfig;

      try {
        const value = hasConfig
          ? this[checker](rawConfig[name])
          : this[checker]();

        if (value === undefined) {
          throw new Error(`Checker \`${checker}()\` did not return a value. Maybe missing a \`return\`?`);
        }

        props[name] = value;

        if (hasConfig) {
          leftovers.delete(name);
        }
      } catch (e) {
        if (!hasConfig) {
          throw new Error(`Missing required configuration property: \`${name}\``);
        }
        throw e;
      }
    }

    if (leftovers.size !== 0) {
      const names = [...leftovers].join(', ');
      const word  = (leftovers.size === 1) ? 'property' : 'properties';
      throw new Error(`Extra configuration ${word}: \`${names}\``)
    }

    const finalProps = this._impl_validate(props);

    if (finalProps === undefined) {
      throw new Error(`\`_impl_validate()\` did not return a value. Maybe missing a \`return\`?`);
    }

    for (const [key, value] of Object.entries(finalProps)) {
      Reflect.defineProperty(this, key, {
        configurable: false,
        enumerable:   true,
        writable:     false,
        value
      });
    }
  }

  /**
   * Finds all the `_config_*` methods on `this`, returning a map from the
   * plain property name to the check method name.
   *
   * @returns {Map<string, string>} The map from property names to corresponding
   *   checker method names.
   */
  #findConfigCheckers() {
    const result = new Map();
    let   target = this;

    for (;;) {
      const keys = Reflect.ownKeys(target);

      for (const k of keys) {
        const name = k.match(/^_config_(?<name>.*)$/)?.groups.name ?? null;
        if (name && !result.has(name)) {
          const pd = Reflect.getOwnPropertyDescriptor(target, k);
          if (typeof pd.value === 'function') {
            result.set(name, k);
          }
        }
      }

      target = Reflect.getPrototypeOf(target);

      if (!target || (target.constructor === Object)) {
        break;
      }
    }

    return result;
  }
}
