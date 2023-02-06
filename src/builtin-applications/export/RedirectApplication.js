// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig, Uris } from '@this/app-config';
import { ApplicationController, BaseApplication } from '@this/app-framework';
import { MustBe } from '@this/typey';


/**
 * Server that redirects requests to different servers, protocols, paths, etc.
 *
 * Configuration object details:
 *
 * * `{string} target` -- Absolute base URI to redirect to. The relative path of
 *   the incoming request (based on the mount point of the application) is
 *   appended to this value to become the full redirected URI.
 */
export class RedirectApplication extends BaseApplication {
  /** @type {number} The redirect status code to use. */
  #statusCode;

  /** @type {string} The target base URI. */
  #target;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {ApplicationController} controller Controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    this.#statusCode = config.statusCode;

    // Drop the final slash from `target`, because we'll always be appending a
    // path that _starts_ with a slash.
    this.#target = config.target.match(/^(?<target>.*)[/]$/).groups.target;
  }

  /** @override */
  _impl_handleRequest(req, res, next_unused) {
    res.redirect(this.#statusCode, `${this.#target}${req.path}`);
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

  /** @override */
  static get TYPE() {
    return 'redirect-server';
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
