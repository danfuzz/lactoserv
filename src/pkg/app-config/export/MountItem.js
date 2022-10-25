// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TreePathKey } from '@this/collections';

import { BaseConfigurationItem } from '#x/BaseConfigurationItem';
import { Names } from '#x/Names';
import { Uris } from '#x/Uris';

/**
 * Configuration representation for a mount point, used in configuring servers.
 * (See {@link ServerItem}.)
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * `{string} application` -- Name of the application being mounted.
 * * `{string} at` -- Mount point for the application, in the form
 *   `//<hostname>/` or `//<hostname>/<base-path>/`, where `hostname` is the
 *   name of a configured host, and `base-path` is the absolute path which the
 *   application should respond to on that host. Subdomain and complete
 *   wildcards are allowed for `hostname`.
 */
export class MountItem extends BaseConfigurationItem {
  /** @type {string} The name of the application being mounted. */
  #application;

  /** @type {string} The mount point (original form). */
  #at;

  /** @type {TreePathKey} The hostname parsed from {@link #at}. */
  #hostname;

  /** @type {TreePathKey} The path parsed from {@link #at}. */
  #path;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    const { application, at } = config;

    this.#application = Names.checkName(application);
    this.#at          = at;

    const { hostname, path } = Uris.parseMount(at);
    this.#hostname = hostname;
    this.#path     = path;
  }

  /** @returns {string} The name of the application being mounted. */
  get application() {
    return this.#application;
  }

  /** @returns {string} The mount point. */
  get at() {
    return this.#at;
  }

  /** @returns {TreePathKey} The hostname parsed from {@link #at}. */
  get hostname() {
    return this.#hostname;
  }

  /** @returns {TreePathKey} The path parsed from {@link #at}. */
  get path() {
    return this.#path;
  }
}
