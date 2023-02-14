// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';

import { BaseConfig } from '#x/BaseConfig';
import { ConfigClassMapper } from '#x/ConfigClassMapper';
import { Names } from '#x/Names';
import { Uris } from '#x/Uris';


/**
 * Configuration representation for a mount point, used in configuring servers.
 * (See {@link ServerConfig}.)
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * `{string} application` -- Name of the application being mounted.
 * * `{string} at` -- Mount point for the application, in the form
 *   `//<hostname>/` or `//<hostname>/<base-path>/`, where `hostname` is the
 *   name of a configured host, and `base-path` is the absolute path which the
 *   application should respond to on that host. Subdomain and complete
 *   wildcards are allowed for `hostname`. The path is more or less implied to
 *   be a wildcard, in that everything at or under the mount point is to be
 *   controlled by the indicated application unless some sub-tree under it has
 *   some other application mounted.
 */
export class MountConfig extends BaseConfig {
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
   * @param {object} config Configuration object. See class header for details.
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


  //
  // Static members
  //

  /**
   * Override of the default method in {@link BaseConfig}, to call through to
   * {@link #parseSingleOrMultiple} instead of using the class constructor
   * directly.
   *
   * @override
   * @param {object|object[]} items Configuration object or array of same.
   * @param {?ConfigClassMapper} [configClassMapper = null] Optional mapper from
   *   configuration objects to corresponding configuration classes. In this
   *   case it is required to be `null`.
   * @returns {MountConfig[]} Frozen array of instances of the called class, if
   *   successfully parsed.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArray(items, configClassMapper = null) {
    if (items === null) {
      throw new Error('`items` must be non-null.');
    } else if (!Array.isArray(items)) {
      items = [items];
    }

    if (configClassMapper !== null) {
      throw new Error('Non-null `configClassMapper` not supported.');
    }

    const result = [];
    for (const item of items) {
      if (item instanceof this) {
        result.push(item);
      } else {
        result.push(...this.parseSingleOrMultiple(item));
      }
    }

    return Object.freeze(result);
  }

  /**
   * Parses a configuration which is _either_ a single mount as parseable by
   * this class's constructor, _or_ a multiple mount, where `at` is passed as an
   * array instead of a single item.
   *
   * @param {object} config Configuration, per the above description.
   * @returns {MountConfig[]} Array of parsed configurations.
   */
  static parseSingleOrMultiple(config) {
    const { at } = config;

    if (Array.isArray(at)) {
      const oneConfig = { ...config };
      const result = [];
      for (const oneAt of at) {
        oneConfig.at = oneAt;
        result.push(new this(oneConfig));
      }
      return result;
    } else {
      return [new this(config)];
    }
  }
}
