// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { NamedConfig } from '#x/NamedConfig';
import { Names } from '#x/Names';


/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique class/type
 * (represented as a class _name_).
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * Bindings as defined by the superclass, {@link NamedConfig}.
 * * `{string} class` -- The (name of the) class of the item.
 */
export class TypedConfig extends NamedConfig {
  /** @type {string} The (name of the) class of the item. */
  #class;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    this.#class = Names.checkType(config.class);
  }

  /** @returns {string} The (name of the) type of the item. */
  get class() {
    return this.#class;
  }
}
