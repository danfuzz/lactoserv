// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';
import { Methods, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for the exported (public) application classes.
 */
export class BaseApplication extends BaseComponent {
  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    MustBe.instanceOf(config, ApplicationConfig);

    super(config, logger);
  }

  /**
   * Handles a request, as defined by the Express middleware spec.
   *
   * @abstract
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(?object=)} next Function which causes the next-bound
   *   middleware to run.
   */
  handleRequest(req, res, next) {
    Methods.abstract(req, res, next);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // TODO: Nothing to do here... yet!
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // TODO: Nothing to do here... yet!
  }
}
