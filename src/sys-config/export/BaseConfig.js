// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Base class for all configuration representation classes. Each subclass
 * defines specific configuration bindings which are to be passed to the
 * constructor. This class makes no requirement other than that the passed
 * configuration be a plain object.
 */
export class BaseConfig {
  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    MustBe.plainObject(config);
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
   * component class which itself defines a `CONFIG_CLASS` property, the latter
   * which is used as the class of the resulting configuration object.
   *
   * (This method is defined on the base class and acts on behalf of all its
   * subclasses.)
   *
   * @param {*} items Single configuration object or array of them.
   *   Configuration objects are required to be as described by the called
   *   class's (or subclasses') constructor(s).
   * @returns {BaseConfig[]} Frozen array of instances of the called class, if
   *   successfully parsed.
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

  /**
   * Exactly like {@link #parseArray}, except will return `null` if passed
   * `items === null`.
   *
   * @param {*} items Array of configuration objects, or `null`.
   * @returns {?BaseConfig[]} Frozen array of instances, or `null` if
   *   `items === null`.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArrayOrNull(items) {
    if (items === null) {
      return null;
    }

    return this.parseArray(items);
  }
}
