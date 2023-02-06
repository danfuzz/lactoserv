// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { BaseConfig } from '@this/app-config';
import { MustBe } from '@this/typey';

import { BaseControllable } from '#x/BaseControllable';


/**
 * Base class for things that "control" other things in the framework.
 */
export class BaseController extends BaseControllable {
  /**
   * @type {BaseConfig} Configuration for this instance's controlled component.
   */
  #config;

  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   * @param {?function(...*)} logger Instance-specific logger, or `null` if
   *   no logging is to be done.
   */
  constructor(config, logger) {
    super(logger);
    this.#config = MustBe.instanceOf(config, BaseConfig);
  }

  /** @returns {BaseConfig} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Server name. */
  get name() {
    return this.#config.name;
  }
}
