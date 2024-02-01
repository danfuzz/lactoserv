// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ApplicationConfig } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';
import { Uris } from '@this/net-util';
import { MustBe } from '@this/typey';


/**
 * Application that redirects requests to different hosts, protocols, paths,
 * etc. See docs for configuration object details.
 */
export class Redirector extends BaseApplication {
  /** @type {number} The redirect status code to use. */
  #statusCode;

  /** @type {string} The target base URI. */
  #target;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#statusCode = config.statusCode;

    // Drop the final slash from `target`, because we'll always be appending a
    // path that _starts_ with a slash.
    this.#target = config.target.match(/^(?<target>.*)[/]$/).groups.target;
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    return request.sendRedirect(
      `${this.#target}${dispatch.extraString}`,
      { status: this.#statusCode });
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Nothing to do here.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ApplicationConfig {
    /** @type {number} The redirect status code to use. */
    #statusCode;

    /** @type {string} The target base URI. */
    #target;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#statusCode = config.statusCode
        ? MustBe.number(config.statusCode, { minInclusive: 300, maxInclusive: 399 })
        : 301;

      this.#target = Uris.checkBasicUri(config.target);
    }

    /** @returns {string} The target base URI. */
    get statusCode() {
      return this.#statusCode;
    }

    /** @returns {string} The target base URI. */
    get target() {
      return this.#target;
    }
  };
}
