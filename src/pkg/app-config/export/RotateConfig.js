// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';

import { BaseConfig } from '#x/BaseConfig';


/**
 * Configuration representation for file rotation, used in configuring some
 * file-writing services. (See {@link FileServerConfig}.)
 *
 * Accepted configuration bindings (in the constructor). All are optional.
 *
 * * `{?number} atSize` -- Rotate when the file becomes the given size (in
 *   bytes) or greater. If `null`, does not rotate based on size. Default
 *  `null`.
 * * `{?number} checkSecs` -- How often to check for a rotation condition, in
 *   seconds, or `null` to not check. This is only meaningful if `atSize` is
 *   also specified. Default `5 * 60`.
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
export class RotateConfig extends BaseConfig {
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
      atSize      = null,
      checkSecs   = 5 * 60,
      maxOldBytes = null,
      maxOldCount = null,
      onReload    = false,
      onStart     = false,
      onStop      = false,
    } = config;

    this.#atSize = (atSize === null)
      ? null
      : MustBe.number(atSize, { finite: true, minInclusive: 1 });
    this.#checkSecs = MustBe.number(checkSecs, { finite: true, minInclusive: 1 });
    this.#maxOldBytes = (maxOldBytes === null)
      ? null
      : MustBe.number(maxOldBytes, { finite: true, minInclusive: 1 });
    this.#maxOldCount = (maxOldCount === null)
      ? null
      : MustBe.number(maxOldCount, { finite: true, minInclusive: 1 });
    this.#onReload = MustBe.boolean(onReload);
    this.#onStart  = MustBe.boolean(onStart);
    this.#onStop   = MustBe.boolean(onStop);

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
