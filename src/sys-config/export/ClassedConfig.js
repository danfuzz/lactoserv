// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { NamedConfig } from '#x/NamedConfig';


/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique class/type
 * (represented as a class _name_).
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * Bindings as defined by the superclass, {@link NamedConfig}.
 * * `{function(new:object)} class` -- The class of the item to create.
 */
export class ClassedConfig extends NamedConfig {
  /** @type {function(new:object)} The class of the item to create. */
  #class;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const { class: cls } = config;

    this.#class = MustBe.constructorFunction(cls);
  }

  /** @returns {function(new:object)} The class of the item to create. */
  get class() {
    return this.#class;
  }
}
