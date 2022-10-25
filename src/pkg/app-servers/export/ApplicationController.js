// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ApplicationItem } from '@this/app-config';
import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';

import { ApplicationFactory } from '#x/ApplicationFactory';
import { BaseApplication } from '#x/BaseApplication';


/**
 * "Controller" for a single application.
 */
export class ApplicationController {
  /** @type {object} Configuration for the underlying application. */
  #config;

  /** @type {BaseApplication} Actual application instance. */
  #application;

  /**
   * Constructs an insance.
   *
   * @param {ApplicationItem} config Parsed configuration item.
   */
  constructor(config) {
    this.#config      = config;
    this.#application = ApplicationFactory.forType(config.type, config, this);
  }

  /** @returns {BaseApplication} The controlled application instance. */
  get application() {
    return this.#application;
  }

  /** @returns {ApplicationItem} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /** @returns {string} Application name. */
  get name() {
    return this.#config.name;
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
