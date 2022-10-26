// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ServiceItem } from '@this/app-config';
import { Methods } from '@this/typey';

import { ServiceController } from '#x/ServiceController';


/**
 * Base class for system services.
 */
export class BaseService {
  /** @type {ServiceItem} Configuration for this service. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {ServiceItem} config Configuration for this service.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Starts the service. This async-returns once the service is actually
   * running.
   *
   * @abstract
   * @throws {Error} Thrown if there was trouble starting the service.
   */
  async start() {
    Methods.abstract();
  }

  /**
   * Stops the service. This async-returns once the service is actually
   * stopped.
   *
   * @abstract
   * @throws {Error} Thrown if there was trouble running or stopping the
   *   service.
   */
  async stop() {
    Methods.abstract();
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:ServiceItem)} The configuration class for this
   * service.
   */
  static get CONFIG_CLASS() {
    return Methods.abstract();
  }

  /** @returns {string} The type name for this service. */
  static get TYPE() {
    return Methods.abstract();
  }
}
