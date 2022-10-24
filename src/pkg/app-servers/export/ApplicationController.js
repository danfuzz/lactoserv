// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { Uris } from '@this/app-config';
import { HostController } from '@this/app-hosts';
import { TreePathKey } from '@this/collections';
import { JsonSchemaUtil } from '@this/json';
import { MustBe } from '@this/typey';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseApplication } from '#x/BaseApplication';


/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** @type {string} Application name. */
  #name;

  /** @type {object} Configuration for the underlying application. */
  #config;

  /** @type {{hostname: TreePathKey, path: TreePathKey}[]} Mount points. */
  #mounts;

  /** @type {BaseApplication} Actual application instance. */
  #app;

  /**
   * Constructs an insance.
   *
   * @param {object} appConfig Application information configuration item.
   */
  constructor(appConfig) {
    const { name, type } = appConfig;

    const config = { ...appConfig };
    delete config.name;
    delete config.type;
    delete config.mount;
    delete config.mounts;
    Object.freeze(config);

    this.#name   = name;
    this.#config = config;
    this.#mounts =
      Object.freeze(JsonSchemaUtil.singularPluralCombo(appConfig.mount, appConfig.mounts))
        .map(mount => Uris.parseMount(mount));
    this.#app    = ApplicationFactory.forType(type, this);
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get app() {
    return this.#app;
  }

  /** @returns {object} Configuration for the underlying application. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#name;
  }

  /** @returns {{hostname: TreePathKey, path: TreePathKey}[]} Mount points. */
  get mounts() {
    return this.#mounts;
  }


  //
  // Static members
  //

  /**
   * Parses a path into a non-wildcard key. The only syntactic check performed
   * by this method is to ensure that `path` begins with a slash (`/`).
   *
   * **Note:** The result will have an empty-string path component at the
   * end if the given `path` ends with a slash.
   *
   * @param {string} path Path to parse.
   * @returns {TreePathKey} Parsed form.
   * @throws {Error} Thrown if `path` is not valid.
   */
  static parsePath(path) {
    MustBe.string(path, /^[/]/);

    const parts = path.split('/');
    parts.shift(); // Shift off the empty component from the initial slash.

    // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
    return new TreePathKey(Object.freeze(parts), false);
  }
}
