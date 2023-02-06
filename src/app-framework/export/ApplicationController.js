// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers';

import { BaseLoggingEnvironment, FormatUtils } from '@this/loggy';
import { WranglerContext } from '@this/network-protocol';
import { MustBe } from '@this/typey';

import { BaseApplication } from '#x/BaseApplication';
import { BaseController } from '#x/BaseController';
import { ThisModule } from '#p/ThisModule';


/**
 * "Controller" for a single application.
 */
export class ApplicationController extends BaseController {
  /** @type {BaseApplication} Actual application instance. */
  #application;

  /**
   * @type {?BaseLoggingEnvironment} Logging environment, or `null` if no
   * logging is to be done.
   */
  #loggingEnv;

  /**
   * Constructs an instance.
   *
   * @param {BaseApplication} application Instance to control.
   */
  constructor(application) {
    MustBe.instanceOf(application, BaseApplication);
    super(application.config, ThisModule.logger.app[application.name]);

    this.#application = application;
    this.#loggingEnv  = application.logger?.$env ?? null;
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get application() {
    return this.#application;
  }

  /**
   * Asks this instance's underlying application to handle the given request.
   * Parameters are as defined by the Express middleware spec.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  handleRequest(req, res, next) {
    this.#application.handleRequest(req, res, next);
  }

  /** @override */
  async _impl_start(isReload) {
    await this.#application.start(isReload);
  }

  /** @override */
  async _impl_stop(willReload) {
    await this.#application.stop(willReload);
  }
}
