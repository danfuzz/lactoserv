// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

/**
 * Base class for all configuration representation classes. Each subclass
 * defines specific configuration bindings which are to be passed to the
 * constructor. This class makes no requirement other than that the passed
 * configuration be a plain object.
 */
export class BaseConfigurationItem {
  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
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
   * element must either be an instance of the called class or plain object
   * suitable for passing to the constructor of the called class.
   *
   * (This method is defined on the base class and acts on behalf of all its
   * subclasses.)
   *
   * @param {*} items Array of configuration objects, as described by the
   *   called class's constructor.
   * @returns {BaseConfigurationItem[]} Frozen array of instances of the
   *   called class, if successfully parsed.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArray(items) {
    if (!Array.isArray(items)) {
      items = [items];
    }

    const result = items.map((item) => {
      return (item instanceof this)
        ? item
        : new this(item);
    });

    return Object.freeze(result);
  }
}
