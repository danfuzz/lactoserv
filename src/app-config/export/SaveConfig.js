// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConfig } from '#x/BaseConfig';
import { FileServiceConfig } from '#x/FileServiceConfig';


/**
 * Configuration representation for file preservation, used in configuring some
 * file-writing services. (See {@link FileServiceConfig}.)
 *
 * Accepted configuration bindings (in the constructor). All are optional.
 *
 * * `{?number} maxOldBytes` -- How many bytes' worth of old (post-rotation)
 *   files should be allowed, or `null` not to have a limit. The oldest files
 *   over the limit get deleted after a rotation. Default `null`.
 * * `{?number} maxOldCount` -- How many old (post-rotation) files should be
 *   allowed, or `null` not to have a limit. The oldest files over the limit get
 *   deleted after a rotation. Default `null`.
 * * `{?boolean} onReload` -- Rotate when the system is reloaded (restarted
 *   in-process). Default `false`.
 * * `{?boolean} onStart` -- Rotate when the system is first started? Default
 *   `false`.
 * * `{?boolean} onStop` -- Rotate when the system is about to be stopped?
 *   Default `false`.
 */
export class SaveConfig extends BaseConfig {
  /**
   * @type {?number} The maximum number of old-file bytes to allow, if so
   * limited.
   */
  #maxOldBytes;

  /**
   * @type {?number} The maximum number of old files to allow, if so limited.
   */
  #maxOldCount;

  /** @type {boolean} Rotate when reloading the system? */
  #onReload;

  /** @type {boolean} Rotate when starting the system? */
  #onStart;

  /** @type {boolean} Rotate when stopping the system? */
  #onStop;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      maxOldBytes = null,
      maxOldCount = null,
      onReload    = false,
      onStart     = false,
      onStop      = false
    } = config;

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
