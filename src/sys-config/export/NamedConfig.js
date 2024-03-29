// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Names } from '@this/sys-compote';

import { BaseConfig } from '#x/BaseConfig';


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
export class NamedConfig extends BaseConfig {
  /**
   * The item's name.
   *
   * @type {string}
   */
  #name;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
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
