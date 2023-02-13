// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';


/**
 * Static content server. Configuration object details:
 *
 * * `{string} siteDirectory` -- Absolute path to the base directory for the
 *   site files.
 */
export class StaticFiles extends BaseApplication {
  /** @type {function(...*)} "Middleware" handler function for this instance. */
  #handleRequest;

  /**
   * @type {?string} Path to the file to server for a not-found result, or
   * `null` if not-found handling shouldn't be done.
   */
  #notFoundPath;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#notFoundPath  = config.notFoundPath;
    this.#handleRequest = express.static(config.siteDirectory);
  }

  /** @override */
  _impl_handleRequest(req, res, next) {
    if (this.#notFoundPath) {
      const innerNext = (error) => {
        if (error) {
          next(error);
        } else {
          res.status(404).sendFile(this.#notFoundPath);
        }
      };
      this.#handleRequest(req, res, innerNext);
    } else {
      this.#handleRequest(req, res, next);
    }
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
    /**
     * @type {?string} Path to the file to server for a not-found result, or
     * `null` if not-found handling shouldn't be done.
     */
    #notFoundPath;

    /** @type {string} The base directory for the site files. */
    #siteDirectory;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#notFoundPath  = Files.checkAbsolutePath(config.notFoundPath);
      this.#siteDirectory = Files.checkAbsolutePath(config.siteDirectory);
    }

    /** @returns {string} The base directory for the site files. */
    get siteDirectory() {
      return this.#siteDirectory;
    }

    /**
     * @returns {?string} Path to the file to server for a not-found result, or
     * `null` if not-found handling shouldn't be done.
     */
    get notFoundPath() {
      return this.#notFoundPath;
    }
  };
}
