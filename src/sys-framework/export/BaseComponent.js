// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '@this/sys-config';
import { MustBe } from '@this/typey';

import { BaseControllable } from '#x/BaseControllable';


/**
 * Base class for major "components" of the framework. Notably, instances of
 * this class must always have (string) names, and those names must be unique
 * within the instances' hierarchies. The base class of this class, {@link
 * BaseControllable} does not do instance naming at all.
 */
export class BaseComponent extends BaseControllable {
  /** @type {BaseConfig} Configuration for this component. */
  #config;

  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   */
  constructor(config) {
    super();
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
