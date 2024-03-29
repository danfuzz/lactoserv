// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseConfig } from '@this/sys-compote';
import { MustBe } from '@this/typey';

import { FileServiceConfig } from '#x/FileServiceConfig';


/**
 * Configuration representation for file preservation, used in configuring some
 * file-writing services. (See {@link FileServiceConfig}.)
 * See `doc/configuration.md` for configuration object details.
 */
export class SaveConfig extends BaseConfig {
  /**
   * The maximum number of old-file bytes to allow, if so limited.
   *
   * @type {?number}
   */
  #maxOldBytes;

  /**
   * The maximum number of old files to allow, if so limited.
   *
   * @type {?number}
   */
  #maxOldCount;

  /**
   * Rotate when reloading the system?
   *
   * @type {boolean}
   */
  #onReload;

  /**
   * Rotate when starting the system?
   *
   * @type {boolean}
   */
  #onStart;

  /**
   * Rotate when stopping the system?
   *
   * @type {boolean}
   */
  #onStop;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const {
      maxOldBytes = null,
      maxOldCount = null,
      onReload    = false,
      onStart     = false,
      onStop      = false
    } = rawConfig;

    this.#maxOldBytes = (maxOldBytes === null)
      ? null
      : MustBe.number(maxOldBytes, { finite: true, minInclusive: 1 });
    this.#maxOldCount = (maxOldCount === null)
      ? null
      : MustBe.number(maxOldCount, { finite: true, minInclusive: 1 });
    this.#onReload = MustBe.boolean(onReload);
    this.#onStart  = MustBe.boolean(onStart);
    this.#onStop   = MustBe.boolean(onStop);
  }

  /**
   * @returns {?number} The maximum number of old-file bytes to allow, or `null`
   * if there is no limit.
   */
  get maxOldBytes() {
    return this.#maxOldBytes;
  }

  /**
   * @returns {?number} The maximum number of old files to allow, or `null` if
   * there is no limit.
   */
  get maxOldCount() {
    return this.#maxOldCount;
  }

  /** @returns {boolean} Rotate when reloading the system? */
  get onReload() {
    return this.#onReload;
  }

  /** @returns {boolean} Rotate when starting the system? */
  get onStart() {
    return this.#onStart;
  }

  /** @returns {boolean} Rotate when stopping the system? */
  get onStop() {
    return this.#onStop;
  }
}
