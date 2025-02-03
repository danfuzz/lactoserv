// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
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


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

      /**
       * The redirect status code to use.
       *
       * @param {number} [value] Proposed configuration value. Default `308`.
       * @returns {number} Accepted configuration value.
       */
      _config_statusCode(value = 308) {
        return MustBe.number(value, { minInclusive: 300, maxInclusive: 399 });
      }

      /**
       * The target base URI.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_target(value) {
        return UriUtil.mustBeBasicUri(value);
      }

      /**
       * `cache-control` header to automatically include, or `null` not to
       * include it. Can be passed either as a literal string or an object to be
       * passed to {@link HttpUtil#cacheControlHeader}.
       *
       * @param {?string|object} [value] Proposed configuration value. Default
       *   `null`.
       * @returns {?string} Accepted configuration value.
       */
      _config_cacheControl(value = null) {
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
}
