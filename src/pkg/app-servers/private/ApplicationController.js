// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationFactory } from '#p/ApplicationFactory';

/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** {string} Application name. */
  #name;

  /** {string} Application type. */
  #type;

  /** {object[]} Mount points, as an array of pairs of `{server, path}`. */
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
    this.#type = appConfig.type;

    const mountArray = appConfig.mount ? [appConfig.mount] : [];
    const mountsArray = appConfig.mounts ?? [];
    this.#mounts = Object.freeze(
      [...mountArray, ...mountsArray].map((mount) =>
        ApplicationController.#parseMount(mount))
    );

    const extraConfig = {...appConfig};
    delete extraConfig.name;
    delete extraConfig.type;
    delete extraConfig.mount;
    delete extraConfig.mounts;
    this.#app = ApplicationFactory.forType(this.#type, extraConfig);
  }

  /** {BaseApplication} The controlled application instance. */
  get app() {
    return this.#app;
  }

  /** {string} Application name. */
  get name() {
    return this.#name;
  }

  /** {string} Application type. */
  get type() {
    return this.#type;
  }

  /** {object[]} Mount points, as an array of pairs of `{server, path}`. */
  get mounts() {
    return this.#mounts;
  }

  /**
   * Parses a mount point into its two components.
   *
   * @param {string} mount Mount point.
   * @returns {object} Components thereof.
   */
  static #parseMount(mount) {
    const result = /^[/][/](?<server>[^/]+)(?<path>[/].*)$/.exec(mount);
    if (!result) {
      throw new Error(`Strange mount point: ${mount}`);
    }

    return Object.freeze({
      server: result.groups.server,
      path:   result.groups.path
    })
  }
}
