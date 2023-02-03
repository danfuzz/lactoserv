// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';
import { Methods, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    MustBe.instanceOf(config, ServiceConfig);

    super(config, logger);
  }

  /**
   * Starts the service. This async-returns once the service is actually
   * running.
   *
   * @abstract
   * @param {boolean} isReload Is this action due to an in-process reload?
   * @throws {Error} Thrown if there was trouble starting the service.
   */
  async start(isReload) {
    Methods.abstract(isReload);
  }

  /**
   * Stops the service. This async-returns once the service is actually
   * stopped.
   *
   * @abstract
   * @param {boolean} willReload Is this action due to an in-process reload
   *   being requested?
   * @throws {Error} Thrown if there was trouble running or stopping the
   *   service.
   */
  async stop(willReload) {
    Methods.abstract(willReload);
  }
}
