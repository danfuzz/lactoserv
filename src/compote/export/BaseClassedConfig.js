// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConfig } from '#x/BaseConfig';


/**
 * Class for configuration representations of things that each have a
 * unique-to-its-domain name and a not-necessarily-unique class/type.
 *
 * Accepted configuration bindings (in the constructor):
 *
 * * Bindings as defined by the superclass, {@link BaseConfig}.
 * * `{function(new:object)} class` -- The class of the item to create. This is
 *   required.
 */
export class BaseClassedConfig extends BaseConfig {
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
   * @param {boolean} [requireName] Is a `name` binding required?
   */
  constructor(rawConfig, requireName = false) {
    super(rawConfig, requireName);

    const { class: cls } = rawConfig;

    this.#class = MustBe.constructorFunction(cls);
  }

  /** @returns {function(new:object)} The class of the item to create. */
  get class() {
    return this.#class;
  }
}
