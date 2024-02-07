// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '@this/sys-config';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

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
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(logger);
    this.#config = MustBe.instanceOf(config, this.constructor.CONFIG_CLASS);
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
    return BaseConfig;
  }
}
