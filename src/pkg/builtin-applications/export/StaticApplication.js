// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { ApplicationController, BaseApplication } from '@this/app-framework';


/**
 * Static content server. Configuration object details:
 *
 * * `{string} siteDirectory` -- Absolute path to the base directory for the
 *   site files.
 */
export class StaticApplication extends BaseApplication {
  /* @type {function(...*)} "Middleware" handler function for this instance. */
  #handleRequest;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {ApplicationController} controller Controller for this instance.
   */
  constructor(config, controller) {
    super(config, controller);

    this.#handleRequest = express.static(config.siteDirectory);
  }

  /** @override */
  handleRequest(req, res, next) {
    this.#handleRequest(req, res, next);
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
    return 'static-server';
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ApplicationConfig {
    /** @type {string} The base directory for the site files. */
    #siteDirectory;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#siteDirectory = Files.checkAbsolutePath(config.siteDirectory);
    }

    /** @returns {string} The base directory for the site files. */
    get siteDirectory() {
      return this.#siteDirectory;
    }
  };
}
