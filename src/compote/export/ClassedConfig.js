// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseNamedConfig } from '#x/BaseNamedConfig';


/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique class/type.
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * Bindings as defined by the superclass, {@link BaseNamedConfig}.
 * * `{function(new:object)} class` -- The class of the item to create.
 */
export class ClassedConfig extends BaseNamedConfig {
  /**
   * The class of the item to create.
   *
   * @type {function(new:object)}
   */
  #class;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { class: cls } = rawConfig;

    this.#class = MustBe.constructorFunction(cls);
  }

  /** @returns {function(new:object)} The class of the item to create. */
  get class() {
    return this.#class;
  }
}
