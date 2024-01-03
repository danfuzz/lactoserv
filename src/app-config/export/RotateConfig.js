// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { FileServiceConfig } from '#x/FileServiceConfig';
import { SaveConfig } from '#x/SaveConfig';


/**
 * Configuration representation for file rotation, used in configuring some
 * file-writing services. (See {@link FileServiceConfig}.)
 *
 * Accepted configuration bindings (in the constructor). All are optional.
 *
 * * Everything accepted by {@link RotateConfig}.
 * * `{?number} atSize` -- Rotate when the file becomes the given size (in
 *   bytes) or greater. If `null`, does not rotate based on size. Default
 *  `null`.
 * * `{?number} checkSecs` -- How often to check for a rotation condition, in
 *   seconds, or `null` to not check. This is only meaningful if `atSize` is
 *   also specified. Default `5 * 60`.
 */
export class RotateConfig extends SaveConfig {
  /** @type {?number} The file size at which to rotate, if ever. */
  #atSize;

  /**
   * @type {?number} How often to check for rotation eligibility, in seconds, if
   * at all.
   */
  #checkSecs;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      atSize      = null,
      checkSecs   = 5 * 60
    } = config;

    this.#atSize = (atSize === null)
      ? null
      : MustBe.number(atSize, { finite: true, minInclusive: 1 });
    this.#checkSecs = MustBe.number(checkSecs, { finite: true, minInclusive: 1 });

    if (this.#atSize === null) {
      // `checkSecs` is irrelevant in this case.
      this.#checkSecs = null;
    }
  }

  /**
   * @returns {?number} The file size at which to rotate, or `null` not to do
   * file size checks.
   */
  get atSize() {
    return this.#atSize;
  }

  /**
   * @returns {?number} How often to check for rotation eligibility, in seconds,
   * or `null` not to ever check.
   */
  get checkSecs() {
    return this.#checkSecs;
  }
}
