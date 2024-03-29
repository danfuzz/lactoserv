// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '#x/BaseConfig';
import { Names } from '#x/Names';


/**
 * Base class for configuration representations of things that are each
 * identified by a unique-within-its-hierarchy name.
 *
 * This class requires passed `config` objects to include a `name` binding, with
 * a value that passes {@link Names#checkName}.
 *
 * Subclasses can of course define additional configuration bindings.
 */
export class BaseNamedConfig extends BaseConfig {
  /**
   * The item's name.
   *
   * @type {string}
   */
  #name;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object. See class header for
   *   details.
   */
  constructor(rawConfig) {
    super(rawConfig);

    this.#name = Names.checkName(rawConfig.name);
  }

  /** @returns {string} The item's name. */
  get name() {
    return this.#name;
  }
}
