// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocky';
import { BaseConfig } from '@this/compy';
import { Duration } from '@this/data-values';
import { Paths, Statter } from '@this/fs-util';
import { MustBe } from '@this/typey';
import { BaseService } from '@this/webapp-core';


/**
 * Base class for services which write one or more files to a particular
 * directory.
 *
 * See `doc/configuration` for details on how instances of this class are
 * configured.
 */
export class BaseFileService extends BaseService {
  // @defaultConstructor

  /**
   * Creates the directory of `config.path`, if it doesn't already exist.
   */
  async _prot_createDirectoryIfNecessary() {
    const { directory } = this.config.pathParts;

    if (!await Statter.directoryExists(directory)) {
      await fs.mkdir(directory, { recursive: true });
    }
  }

  /**
   * "Touches" (and creates if necessary) the file at {@link #path}.
   */
  async _prot_touchPath() {
    const path = this.config.path;

    if (await Statter.pathExists(path)) {
      // File already exists; just update the modification time.
      const dateNow = WallClock.now().toDate();
      await fs.utimes(path, dateNow, dateNow);
    } else {
      await fs.appendFile(path, '');
    }
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return BaseFileService.Config;
  }

  /**
   * Configuration class for this (outer) class.
   */
  static Config = class Config extends BaseService.Config {
    /**
     * The absolute path to use.
     *
     * @type {string}
     */
    #path;

    /**
     * Path parts, or `null` if not yet calculated.
     *
     * @type {?object}
     */
    #pathParts = null;

    /**
     * Rotation configuration, if any.
     *
     * @type {?BaseFileService.RotateConfig}
     */
    #rotate;

    /**
     * Preservation configuration, if any.
     *
     * @type {?BaseFileService.SaveConfig}
     */
    #save;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object. See class header for
     *   details.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { path, rotate, save } = rawConfig;

      if (rotate && save) {
        throw new Error('Cannot specify both `rotate` and `save`.');
      }

      this.#path   = Paths.checkAbsolutePath(path);
      this.#rotate = rotate ? new BaseFileService.RotateConfig(rotate) : null;
      this.#save   = save   ? new BaseFileService.SaveConfig(save)     : null;
    }

    /**
     * @returns {string} The absolute path to write to (with possible infixing
     * of the final path component, depending on the specific use case).
     */
    get path() {
      return this.#path;
    }

    /**
     * The various parts of {@link #path}. The return value is a frozen plain
     * object with the following properties:
     *
     * * `path` -- The original path (for convenience).
     * * `directory` -- The directory leading to the final path component, that
     *   is, everything but the final path component. This _not_ end with a
     *   slash, so in the case of a root-level file, this is the empty string.
     * * `fileName` -- The final path component.
     * * `filePrefix` -- The "prefix" portion of the file name, which is defined
     *   as everything up to but not including the last dot (`.`) in the name.
     *   If there is no dot in the name, then this is the same as `fileName`.
     * * `fileSuffix` -- The "suffix" portion of the file name, which is
     *   everything not included in `filePrefix`. If there is no dot in the
     *   name, then this is the empty string.
     *
     * @returns {object} The split path, as described.
     */
    get pathParts() {
      if (!this.#pathParts) {
        this.#pathParts = this.#makePathParts();
      }

      return this.#pathParts;
    }

    /**
     * @returns {?BaseFileService.RotateConfig} Rotation configuration, if any.
     */
    get rotate() {
      return this.#rotate;
    }

    /**
     * @returns {?BaseFileService.SaveConfig} Preservation configuration, if
     * any. If this instance has a {@link #RotateConfig}, that is returned here
     * too (it's a subclass).
     */
    get save() {
      return this.#save ?? this.#rotate;
    }

    /**
     * Calculates the value for {@link #pathParts}.
     *
     * @returns {object} The split path, as described.
     */
    #makePathParts() {
      const path = this.#path;

      const { directory, fileName } =
        path.match(/^(?<directory>.*)[/](?<fileName>[^/]+)$/).groups;

      const { filePrefix, fileSuffix = '' } =
        fileName.match(/^(?<filePrefix>.*?)(?<fileSuffix>[.][^.]*)?$/).groups;

      return Object.freeze({ path, directory, fileName, filePrefix, fileSuffix });
    }
  };

  /**
   * Configuration class for `save` bindings.
   */
  static SaveConfig = class SaveConfig extends BaseConfig {
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
        onStart     = false,
        onStop      = false
      } = rawConfig;

      this.#maxOldBytes = (maxOldBytes === null)
        ? null
        : MustBe.number(maxOldBytes, { finite: true, minInclusive: 1 });
      this.#maxOldCount = (maxOldCount === null)
        ? null
        : MustBe.number(maxOldCount, { finite: true, minInclusive: 1 });
      this.#onStart  = MustBe.boolean(onStart);
      this.#onStop   = MustBe.boolean(onStop);
    }

    /**
     * @returns {?number} The maximum number of old-file bytes to allow, or
     * `null` if there is no limit.
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

    /** @returns {boolean} Rotate when starting the system? */
    get onStart() {
      return this.#onStart;
    }

    /** @returns {boolean} Rotate when stopping the system? */
    get onStop() {
      return this.#onStop;
    }
  };

  /**
   * Configuration class for `rotate` bindings.
   */
  static RotateConfig = class RotateConfig extends BaseFileService.SaveConfig {
    /**
     * The file size at which to rotate, if ever.
     *
     * @type {?number}
     */
    #atSize;

    /**
     * How often to check for rotation eligibility, if at all.
     *
     * @type {?Duration}
     */
    #checkPeriod;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        atSize      = null,
        checkPeriod = null
      } = rawConfig;

      this.#atSize = (atSize === null)
        ? null
        : MustBe.number(atSize, { finite: true, minInclusive: 1 });

      this.#checkPeriod = Duration.parse(checkPeriod ?? '5 min', { minInclusive: 1 });
      if (!this.#checkPeriod) {
        throw new Error(`Could not parse \`checkPeriod\`: ${checkPeriod}`);
      }

      if (this.#atSize === null) {
        // `checkPeriod` is irrelevant in this case.
        this.#checkPeriod = null;
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
     * @returns {?Duration} How often to check for rotation eligibility, or
     * `null` not to ever check.
     */
    get checkPeriod() {
      return this.#checkPeriod;
    }
  };
}
