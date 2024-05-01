// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse, HttpUtil, UriUtil } from '@this/net-util';
import { AskIf, MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that redirects requests to different hosts, protocols, paths,
 * etc. See docs for configuration object details.
 */
export class Redirector extends BaseApplication {
  /**
   * The redirect status code to use.
   *
   * @type {number}
   */
  #statusCode;

  /**
   * The target base URI.
   *
   * @type {string}
   */
  #target;

  /**
   * `cache-control` header to automatically include, or `null` not to do that.
   *
   * @type {?string}
   */
  #cacheControl = null;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { cacheControl, statusCode, target } = this.config;

    this.#cacheControl = cacheControl;
    this.#statusCode   = statusCode;

    // Drop the final slash from `target`, because we'll always be appending a
    // path that _starts_ with a slash.
    this.#target = target.match(/^(?<target>.*)[/]$/).groups.target;
  }

  /** @override */
  async _impl_handleRequest(request_unused, dispatch) {
    const response = FullResponse.makeRedirect(
      `${this.#target}${UriUtil.pathStringFrom(dispatch.extra)}`,
      this.#statusCode);

    response.cacheControl = this.#cacheControl;

    return response;
  }

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
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
  static #Config = class Config extends BaseApplication.Config {
    // @defaultConstructor

    /**
     * Configuration property `statusCode`: The redirect status code to use.
     *
     * @param {number} [value] Proposed configuration value. Default `308`.
     * @returns {number} Accepted configuration value.
     */
    _check_statusCode(value = 308) {
      return MustBe.number(value, { minInclusive: 300, maxInclusive: 399 });
    }

    /**
     * Configuration property `target`: The target base URI.
     *
     * @param {string} value Proposed configuration value.
     * @returns {string} Accepted configuration value.
     */
    _check_target(value) {
      return UriUtil.checkBasicUri(value);
    }

    /**
     * Configuration property `cacheControl`: `cache-control` header to
     * automatically include, or `null` not to do that.
     *
     * @param {?string} value Proposed configuration value.
     * @returns {?string} Accepted configuration value.
     */
    _check_cacheControl(value) {
      if (value === null) {
        return null;
      } else if (typeof value === 'string') {
        return value;
      } else if (AskIf.plainObject(value)) {
        return HttpUtil.cacheControlHeader(value);
      } else {
        throw new Error('Invalid `cacheControl` option.');
      }
    }
  };
}
