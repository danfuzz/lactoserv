// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as express from 'express';

import { ApplicationItem } from '@this/app-config';
import { Methods } from '@this/typey';

import { ApplicationController } from '#x/ApplicationController';


/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication {
  /** @type {ApplicationItem} Configuration for this application. */
  #config;

  /** @type {ApplicationController} The controller for this instance. */
  #controller;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationItem} config Configuration for this application.
   * @param {ApplicationController} controller Controller for this instance.
   */
  constructor(config, controller) {
    this.#config     = config;
    this.#controller = controller;
  }

  /** @returns {ApplicationController} The controller for this instance. */
  get controller() {
    return this.#controller;
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
