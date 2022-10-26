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
   * element must either be an instance of the called class (or a subclass) or
   * plain object suitable for passing to a constructor which produces an
   * instance of the called class (or a subclass).
   *
   * If the optional second argument is _not_ passed, then all constructor calls
   * are made on the called class. With the second argument `classMapper`, each
   * non-instance item is passed to that function, which is expected to return
   * the class which should be constructed from the item.
   *
   * (This method is defined on the base class and acts on behalf of all its
   * subclasses.)
   *
   * @param {*} items Array of configuration objects, as described by the
   *   called class's (or subclasses') constructor(s).
   * @param {?function(string):
   *   function(new:BaseConfigurationItem)} [configClassMapper = null] Optional
   *   mapper which takes a configuration object and returns the class that
   *   should be constructed from it.
   * @returns {BaseConfigurationItem[]} Frozen array of instances of the
   *   called class, if successfully parsed.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArray(items, configClassMapper = null) {
    if (!Array.isArray(items)) {
      items = [items];
    }

    const result = items.map((item) => {
      if (item instanceof this) {
        return item;
      } else if (!configClassMapper) {
        return new this(item);
      } else {
        const cls = configClassMapper(item);
        return new cls(item);
      }
    });

    return Object.freeze(result);
  }
}
