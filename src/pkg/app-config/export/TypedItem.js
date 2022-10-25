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
 *
 * This class supports use as a concrete class, even for (nominally)
 * subclass-like use cases which require extra configuration, specifically by
 * providing a catch-all {@link #extraConfig} property. TODO: Remove this, once
 * all services have their own config classes.
 */
export class TypedItem extends NamedItem {
  /** @type {string} The (name of the) type of the item. */
  #type;

  /**
   * @type {object} Configuration bindings not parsed by this class (or its
   * superclass).
   */
  #extraConfig;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    const { type } = config;

    const extraConfig = { ...config };
    delete extraConfig.name;
    delete extraConfig.type;

    this.#type =        Names.checkType(type);
    this.#extraConfig = Object.freeze(extraConfig);
  }

  /**
   * @returns {object} Configuration bindings not parsed by this class (or its
   * superclass).
   */
  get extraConfig() {
    return this.#extraConfig;
  }

  /** @returns {string} The (name of the) type of the item. */
  get type() {
    return this.#type;
  }
}
