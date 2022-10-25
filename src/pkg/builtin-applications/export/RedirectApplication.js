// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationItem, Uris } from '@this/app-config';
import { ApplicationController, BaseApplication } from '@this/app-servers';


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
  /** @type {string} The target base URI. */
  #target;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationItem} config Configuration for this application.
   * @param {ApplicationController} controller Controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    // Drop the final slash from `target`, because we'll always be appending a
    // path that _starts_ with a slash.
    this.#target = config.target.match(/^(?<target>.*)[/]$/).groups.target;
  }

  /** @override */
  handleRequest(req, res, next) {
    res.redirect(`${this.#target}${req.path}`);
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
  static #Config = class Config extends ApplicationItem {
    /** @type {string} The target base URI. */
    #target;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#target = Uris.checkBasicUri(config.target);
    }

    /** @returns {string} The target base URI. */
    get target() {
      return this.#target;
    }
  };
}
