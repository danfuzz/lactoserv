// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ServiceConfig } from '@this/app-config';
import { Methods } from '@this/typey';


/**
 * Base class for system services.
 */
export class BaseService {
  /** @type {ServiceConfig} Configuration for this service. */
  #config;

  /**
   * @type {?function(...*)} Instance-specific logger, or `null` if no logging
   * is to be done.
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    this.#config = config;
    this.#logger = logger;
  }

  /** @returns {ServiceConfig} Configuration for this service. */
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

  /** @returns {string} Service name. */
  get name() {
    return this.#config.name;
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
    Methods.abstract();
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:ServiceConfig)} The configuration class for this
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
