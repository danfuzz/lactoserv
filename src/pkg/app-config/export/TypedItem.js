// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { NamedItem } from '#x/NamedItem';
import { Names } from '#x/Names';

/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique type (represented as a
 * type _name_).
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * Bindings as defined by the superclass, {@link NamedItem}.
 * * `{string} type` -- The (name of the) type of the item.
 */
export class TypedItem extends NamedItem {
  /** @type {string} The (name of the) type of the item. */
  #type;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    const { type } = config;

    this.#type = Names.checkType(config.type);
  }

  /** @returns {string} The (name of the) type of the item. */
  get type() {
    return this.#type;
  }
}
