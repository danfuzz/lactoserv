// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationFactory } from '#p/ApplicationFactory';

// Types referenced only in doc comments.
import { BaseApplication } from '#p/BaseApplication';

/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** {string} Application name. */
  #name;

  /** {{hostname: string, path: string}[]} Mount points. */
  #mounts;

  /** {BaseApplication} Actual application instance. */
  #app;

  /**
   * Constructs an insance.
   *
   * @param {object} appConfig Server information configuration item.
   */
  constructor(appConfig) {
    this.#name = appConfig.name;

    const mountArray = appConfig.mount ? [appConfig.mount] : [];
    const mountsArray = appConfig.mounts ?? [];
    this.#mounts = Object.freeze(
      [...mountArray, ...mountsArray].map(mount =>
        ApplicationController.#parseMount(mount))
    );

    const extraConfig = { ...appConfig };
    delete extraConfig.name;
    delete extraConfig.type;
    delete extraConfig.mount;
    delete extraConfig.mounts;
    this.#app = ApplicationFactory.forType(appConfig.type, extraConfig);
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get app() {
    return this.#app;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#name;
  }

  /** @returns {{hostname: string, path: string}[]} Mount points. */
  get mounts() {
    return this.#mounts;
  }


  //
  // Static members
  //

  /**
   * Parses a mount point into its two components.
   *
   * @param {string} mount Mount point.
   * @returns {object} Components thereof.
   */
  static #parseMount(mount) {
    const result = /^[/][/](?<hostname>[^/]+)(?<path>[/].*)$/.exec(mount);
    if (!result) {
      throw new Error(`Strange mount point: ${mount}`);
    }

    return Object.freeze({
      hostname: result.groups.hostname,
      path:     result.groups.path
    });
  }
}
