// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

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
 * * `{?number} maxOldBytes` -- How many bytes' worth of old (post-rotation)
 *   files should be allowed, or `null` not to have a limit. The oldest files
 *   over the limit get deleted after a rotation. Default `null`.
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
   * @type {?number} The maximum number of old-file bytes to allow, if so
   * limited.
   */
  #maxOldBytes;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      atSize      = null,
      checkSecs   = 5 * 60,
      maxOldBytes = null
    } = config;

    this.#atSize = (atSize === null)
      ? null
      : MustBe.number(atSize, { finite: true, minInclusive: 1 });
    this.#checkSecs = MustBe.number(checkSecs, { finite: true, minInclusive: 1 });
    this.#maxOldBytes = (maxOldBytes === null)
      ? null
      : MustBe.number(maxOldBytes, { finite: true, minInclusive: 1 });

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

  /**
   * @returns {?number} The maximum number of old-file bytes to allow, or `null`
   * if there is no limit.
   */
  get maxOldBytes() {
    return this.#maxOldBytes;
  }
}
