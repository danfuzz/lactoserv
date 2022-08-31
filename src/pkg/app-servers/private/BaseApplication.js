// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Methods } from '@this/typey';

// Types referenced only in doc comments.
import * as express from 'express';

/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** @type {Function} Middleware function which activates this instance. */
  #middleware;

  /**
   * Constructs an instance.
   */
  constructor() {
    this.#middleware =
      (req, res, next) => this.handleRequest(req, res, next);
  }

  /**
   * @returns {Function} "Middleware" handler function which activates this
   * instance by calling through to {@link #handleRequest}.
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
   * @param {Function} next Function which causes the next-bound middleware to
   *   run.
   */
  handleRequest(req, res, next) {
    Methods.abstract(req, res, next);
  }
}
