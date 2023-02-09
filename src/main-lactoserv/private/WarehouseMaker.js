// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { Warehouse } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import { LimitedLoader } from '#p/LimitedLoader';
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
      this.#logger.readingConfiguration();
      config = await this.#loadConfig();
      this.#logger.readConfiguration();
    } catch (e) {
      this.#logger.configFileError(e);
      throw e;
    }

    try {
      this.#logger.constructingWarehouse();
      const result = new Warehouse(config);
      this.#logger.constructedWarehouse();
      return result;
    } catch (e) {
      this.#logger.warehouseConstructionError(e);
      throw e;
    }
  }

  /**
   * Loads the configuration file.
   *
   * @returns {object} The result of loading.
   */
  async #loadConfig() {
    const context   = Object.assign(Object.create(global));
    const loader    = new LimitedLoader(context, this.#logger);
    const configUrl = this.#configUrl;

    let module;

    try {
      module = await loader.load(configUrl);
    } catch (e) {
      if (e.name === 'SyntaxError') {
        // There was a syntax error somewhere in the config. TODO: If we ask
        // Node to load it as a top-level script, it might actually elucidate
        // the problem. For now, just note it and throw.
        this.#logger.configFileSyntaxError(e);
      }
      throw e;
    }

    const rawResult = module.namespace.default;

    // We need to do this because the config file was evaluated in a different
    // context from the default one, which means that its primordial objects /
    // classes aren't `===` to the default ones, which can lead to weirdness.
    // `structuredClone()` returns "normal" objects.
    return structuredClone(rawResult);
  }
}
