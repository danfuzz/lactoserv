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
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
    await this.config.thread.start();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    await this.config.thread.stop();
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
    #thread;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { thread } = rawConfig;

      this.#thread = thread;
    }

    /** @returns {IntfThreadlike} The threadlike thing being managed. */
    get thread() {
      return this.#thread;
    }
  };
}
