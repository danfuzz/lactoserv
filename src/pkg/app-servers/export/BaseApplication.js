// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import { Methods } from '@this/typey';

import { ApplicationController } from '#x/ApplicationController';

/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** @type {ApplicationController} The controller for this instance. */
  #controller;

  /**
   * @type {function(...*)} Middleware function which activates this instance.
   */
  #middleware;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationController} controller Controller for this instance.
   */
  constructor(controller) {
    this.#controller = controller;
    this.#middleware =
      (req, res, next) => this.handleRequest(req, res, next);
  }

  /** @returns {ApplicationController} The controller for this instance. */
  get controller() {
    return this.#controller;
  }

  /**
   * @returns {function(...*)} "Middleware" handler function which activates
   * this instance by calling through to {@link #handleRequest}.
   */
  get middleware() {
    return this.#middleware;
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
}
