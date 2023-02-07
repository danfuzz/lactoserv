// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Warehouse } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import { ThisModule } from '#p/ThisModule';


/**
 * Maker of {@link Warehouse} instances. It is configured with a permanent URL
 * to the config file, and can then create or re-(re-...)create warehouse
 * instances from it.
 */
export class WarehouseMaker {
  /** @type {?URL} Configuration URL. */
  #configUrl = null;

  /**
   * @type {?IntfLogger} Logger for this instance, or `null` not to do any
   * logging.
   */
  #logger = ThisModule.logger.system;

  /**
   * Constructs an instance.
   *
   * @param {URL} configUrl Where to find the config file.
   */
  constructor(configUrl) {
    this.#configUrl = MustBe.instanceOf(configUrl, URL);
  }

  /**
   * Makes a warehouse based on the `configUrl` passed in on construction, or
   * reports the error trying to do same.
   *
   * @returns {Warehouse} The constructed warehouse.
   * @throws {Error} Thrown if there's any trouble.
   */
  async make() {
    let config;

    try {
      config = (await import(this.#configUrl)).default;
    } catch (e) {
      this.#logger.configFileError(e);
      throw e;
    }

    try {
      const result = new Warehouse(config);
      this.#logger.constructedWarehouse();
      return result;
    } catch (e) {
      this.#logger.warehouseConstructionError(e);
      throw e;
    }
  }
}
