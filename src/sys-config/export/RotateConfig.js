// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Duration } from '@this/data-values';
import { MustBe } from '@this/typey';

import { FileServiceConfig } from '#x/FileServiceConfig';
import { SaveConfig } from '#x/SaveConfig';


/**
 * Configuration representation for file rotation, used in configuring some
 * file-writing services. (See {@link FileServiceConfig}.)
 *
 * See `doc/configuration.md` for configuration object details.
 */
export class RotateConfig extends SaveConfig {
  /** @type {?number} The file size at which to rotate, if ever. */
  #atSize;

  /**
   * @type {?number} How often to check for rotation eligibility, in seconds, if
   * at all.
   */
  #checkSec;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const {
      atSize      = null,
      checkPeriod = null
    } = config;

    this.#atSize = (atSize === null)
      ? null
      : MustBe.number(atSize, { finite: true, minInclusive: 1 });

    this.#checkSec = Duration.parseSec(checkPeriod ?? '5 min', { minInclusive: 1 });
    if (this.#checkSec === null) {
      throw new Error(`Could not parse \`checkPeriod\`: ${checkPeriod}`);
    }

    if (this.#atSize === null) {
      // `checkPeriod` is irrelevant in this case.
      this.#checkSec = null;
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
  get checkSec() {
    return this.#checkSec;
  }
}
