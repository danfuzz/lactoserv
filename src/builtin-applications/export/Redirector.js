// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy';
import { HttpUtil, OutgoingResponse, Uris } from '@this/net-util';
import { ApplicationConfig } from '@this/sys-config';
import { BaseApplication } from '@this/sys-framework';
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
   * @type {?string} `cache-control` header to automatically include, or
   * `null` not to do that.
   */
  #cacheControl = null;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#cacheControl = config.cacheControl;
    this.#statusCode   = config.statusCode;

    // Drop the final slash from `target`, because we'll always be appending a
    // path that _starts_ with a slash.
    this.#target = config.target.match(/^(?<target>.*)[/]$/).groups.target;
  }

  /** @override */
  async _impl_handleRequest(request_unused, dispatch) {
    const response = OutgoingResponse.makeRedirect(
      `${this.#target}${dispatch.extraString}`,
      this.#statusCode);

    response.cacheControl = this.#cacheControl;

    return response;
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
     * @type {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    #cacheControl = null;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        cacheControl = null,
        statusCode = null,
        target
      } = config;

      this.#statusCode = statusCode
        ? MustBe.number(statusCode, { minInclusive: 300, maxInclusive: 399 })
        : 301;

      this.#target = Uris.checkBasicUri(target);

      if ((cacheControl !== null) && (cacheControl !== false)) {
        this.#cacheControl = (typeof cacheControl === 'string')
          ? cacheControl
          : HttpUtil.cacheControlHeader(cacheControl);
        if (!this.#cacheControl) {
          throw new Error('Invalid `cacheControl` option.');
        }
      }
    }

    /**
     * @returns {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    get cacheControl() {
      return this.#cacheControl;
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
