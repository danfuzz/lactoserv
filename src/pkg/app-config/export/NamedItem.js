// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseConfigurationItem } from '#x/BaseConfigurationItem';
import { Names } from '#x/Names';

/**
 * Base class for configuration representations of things that are each
 * identified by a unique-to-its-domain name.
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * `{string} name` -- The name of the item.
 *
 * Subclasses define additional configuration bindings.
 */
export class NamedItem extends BaseConfigurationItem {
  /** @type {string} The item's name. */
  #name;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    this.#name = Names.checkName(config.name);
  }

  /** @returns {string} The item's name. */
  get name() {
    return this.#name;
  }
}
