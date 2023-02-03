// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { NamedConfig } from '#x/NamedConfig';
import { Names } from '#x/Names';


/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique type (represented as a
 * type _name_).
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * Bindings as defined by the superclass, {@link NamedConfig}.
 * * `{string} type` -- The (name of the) type of the item.
 */
export class TypedConfig extends NamedConfig {
  /** @type {string} The (name of the) type of the item. */
  #type;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    this.#type = Names.checkType(config.type);
  }

  /** @returns {string} The (name of the) type of the item. */
  get type() {
    return this.#type;
  }
}
