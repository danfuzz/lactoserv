// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { FsUtil } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';


/**
 * Static content server. Configuration object details:
 *
 * * `{string} siteDirectory` -- Absolute path to the base directory for the
 *   site files.
 */
export class StaticFiles extends BaseApplication {
  /** @type {function(...*)} "Middleware" handler function for this instance. */
  #staticMiddleware;

  /**
   * @type {?string} Path to the file to serve for a not-found result, or
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

    const { notFoundPath, siteDirectory } = config;

    this.#notFoundPath     = notFoundPath;
    this.#staticMiddleware = express.static(siteDirectory);
  }

  /** @override */
  async _impl_handleRequest(request) {
    const result =
      await BaseApplication.callMiddleware(request, this.#staticMiddleware);

    if (!result && this.#notFoundPath) {
      request.expressResponse.status(404).sendFile(this.#notFoundPath);
      return await BaseApplication.whenEnded(request);
    }

    return result;
  }

  /** @override */
  async _impl_start(isReload_unused) {
    const { notFoundPath, siteDirectory } = this.config;

    if (!await FsUtil.directoryExists(siteDirectory)) {
      throw new Error(`Not found or not a directory: ${siteDirectory}`);
    }

    if (notFoundPath) {
      if (!await FsUtil.fileExists(notFoundPath)) {
        throw new Error(`Not found or not a file: ${notFoundPath}`);
      }
    }
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
     * @type {?string} Path to the file to serve for a not-found result, or
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

      const {
        notFoundPath = null,
        siteDirectory
      } = config;

      this.#notFoundPath = (notFoundPath === null)
        ? null
        : Files.checkAbsolutePath(notFoundPath);
      this.#siteDirectory = Files.checkAbsolutePath(siteDirectory);
    }

    /** @returns {string} The base directory for the site files. */
    get siteDirectory() {
      return this.#siteDirectory;
    }

    /**
     * @returns {?string} Path to the file to serve for a not-found result, or
     * `null` if not-found handling shouldn't be done.
     */
    get notFoundPath() {
      return this.#notFoundPath;
    }
  };
}
