// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { ApplicationConfig } from '@this/app-config';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseApplication } from '#x/BaseApplication';
import { BaseControllable } from '#x/BaseControllable';
import { ThisModule } from '#p/ThisModule';


/**
 * Manager for dealing with all the high-level applications that are running or
 * to be run in the system.
 *
 * **Note:** `start()`ing and `stop()`ing acts on all the applications.
 */
export class ApplicationManager extends BaseControllable {
  /**
   * @type {Map<string, BaseApplication>} Map from each bound application name
   * to the corresponding instance.
   */
  #instances = new Map();

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig[]} configs Configuration objects.
   */
  constructor(configs) {
    super(ThisModule.logger.apps);

    for (const config of configs) {
      this.#addInstanceFor(config);
    }
  }

  /**
   * Gets the {@link BaseApplication} for a given application name.
   *
   * @param {string} name Application name to look for.
   * @returns {BaseApplication} The associated instance.
   * @throws {Error} Thrown if there is no instance with the given name.
   */
  get(name) {
    const instance = this.#instances.get(name);

    if (!instance) {
      throw new Error(`No such application: ${name}`);
    }

    return instance;
  }

  /**
   * Gets a list of all applications managed by this instance.
   *
   * @returns {BaseApplication[]} All the applications.
   */
  getAll() {
    return [...this.#instances.values()];
  }

  /** @override */
  async _impl_start(isReload) {
    const applications = this.getAll();
    const results      = applications.map((s) => s.start(isReload));

    await Promise.all(results);
  }

  /** @override */
  async _impl_stop(willReload) {
    const applications = this.getAll();
    const results      = applications.map((s) => s.stop(willReload));

    await Promise.all(results);
  }

  /**
   * Constructs a {@link BaseApplication} based on the given information, and
   * adds a mapping to {@link #instances} so it can be found.
   *
   * @param {ApplicationConfig} config Parsed configuration item.
   */
  #addInstanceFor(config) {
    const name = config.name;

    if (this.#instances.has(name)) {
      throw new Error(`Duplicate application: ${name}`);
    }

    const appLogger = ThisModule.baseApplicationLogger[name];
    const instance  = ApplicationFactory.makeInstance(config, appLogger);

    this.#instances.set(name, instance);
    this.logger.bound(name);
  }
}
