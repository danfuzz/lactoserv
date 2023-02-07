// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig } from '@this/app-config';
import { IntfLogger } from '@this/loggy';
import { Methods, MustBe } from '@this/typey';

import { BaseControllable } from '#x/BaseControllable';


/**
 * Base class for major "components" of the framework.
 */
export class BaseComponent extends BaseControllable {
  /** @type {BaseConfig} Configuration for this component. */
  #config;

  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   * @param {?IntfLogger} logger Instance-specific logger, or `null` if no
   *   logging is to be done.
   */
  constructor(config, logger) {
    super(logger);
    this.#config = MustBe.instanceOf(config, BaseConfig);
  }

  /** @returns {BaseConfig} Configuration for this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Component name. */
  get name() {
    return this.#config.name;
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:BaseConfig)} The configuration class for this
   * component.
   */
  static get CONFIG_CLASS() {
    return Methods.abstract();
  }

  /** @returns {string} The type name for this component. */
  static get TYPE() {
    return Methods.abstract();
  }
}
