// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Base class for configuration representation classes. Component subclasses
 * that use configuration objects _may_ but _do not have to_ use subclasses of
 * this class for their configuration; it is meant to be an attractive but not
 * necessary choice.
 *
 * Each subclass of this class defines specific configuration bindings which are
 * to be passed to the constructor. This class makes no requirement other than
 * that the configuration passed to the constructor be a plain object.
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
  }


  //
  // Static members
  //

  /**
   * Parses a single configuration object or array of them into an array of
   * instances of the concrete class that this method was called on. Each array
   * element must either be an instance of the called class (or a subclass) or
   * plain object suitable for passing to a constructor which produces an
   * instance of the called class (or a subclass).
   *
   * Items which have a `class` property expect that property to refer to a
   * component class which defines a non-`null` configuration class, via an
   * appropriate override of the `static` method `_impl_configClass()`.
   *
   * (This method is defined on the base class and acts on behalf of all its
   * subclasses.)
   *
   * @param {*} items Single configuration object or array of them.
   *   Configuration objects are required to be as described by the called
   *   class's (or subclasses') constructor(s).
   * @returns {Array<BaseConfig>} Frozen array of instances of the called class,
   *   if successfully parsed.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArray(items) {
    if (items === null) {
      throw new Error('`items` must be non-null.');
    } else if (!Array.isArray(items)) {
      items = [items];
    }

    const result = items.map((item) => {
      if (item instanceof this) {
        return item;
      }

      const itemClass   = item.class;
      const configClass = itemClass ? itemClass.CONFIG_CLASS : this;

      if (!configClass) {
        throw new Error('Item\'s `class` missing `CONFIG_CLASS` property.');
      }

      return new configClass(item);
    });

    return Object.freeze(result);
  }
}
