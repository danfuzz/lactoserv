// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import { ApplicationItem } from '@this/app-config';
import { Methods } from '@this/typey';


/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** @type {ApplicationItem} Configuration for this application. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationItem} config Configuration for this application.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  /** @returns {ApplicationItem} Configuration for this application. */
  get config() {
    return this.#config;
  }

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  get logger() {
    return this.#logger;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#config.name;
  }

  /**
   * Handles a request, as defined by the Express middleware spec.
   *
   * @abstract
   * @param {express.Request} req Request object.
   * @param {express.Response} res Response object.
   * @param {function(?object=)} next Function which causes the next-bound
   *   middleware to run.
   */
  handleRequest(req, res, next) {
    Methods.abstract(req, res, next);
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:ApplicationItem)} The configuration class for this
   * application.
   */
  static get CONFIG_CLASS() {
    return Methods.abstract();
  }

  /** @returns {string} The type name for this application. */
  static get TYPE() {
    return Methods.abstract();
  }
}
