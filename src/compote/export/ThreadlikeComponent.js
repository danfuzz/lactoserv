// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfThreadlike } from '@this/async';

import { BaseComponent } from '#x/BaseComponent';
import { BaseConfig } from '#x/BaseConfig';


/**
 * Concrete component whose purpose in life is to start and stop an {@link
 * IntfThreadlike} (e.g. a `Threadlet` or similar).
 */
export class ThreadlikeComponent extends BaseComponent {
  // @defaultConstructor

  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    await this.config.threadlet.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.config.threadlet.stop();
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseConfig {
    /**
     * The threadlike thing being managed.
     *
     * @type {IntfThreadlike}
     */
    #threadlike;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { threadlike } = rawConfig;

      this.#threadlike = threadlike;
    }

    /** @returns {IntfThreadlike} The threadlike thing being managed. */
    get threadlike() {
      return this.#threadlike;
    }
  };
}
