// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// All code and assets are considered proprietary and unlicensed.

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { ApplicationController, BaseApplication } from '@this/app-servers';


/**
 * Static content server. Configuration object details:
 *
 * * `{string} assetsPath` -- Absolute path to the base directory for the
 *   static assets.
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

    this.#handleRequest = express.static(config.assetsPath);
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
    /** @type {string} The assets path. */
    #assetsPath;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      this.#assetsPath = Files.checkAbsolutePath(config.assetsPath);
    }

    /** @returns {string} The assets path. */
    get assetsPath() {
      return this.#assetsPath;
    }
  };
}
