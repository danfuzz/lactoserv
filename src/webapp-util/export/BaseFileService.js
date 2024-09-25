// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { WallClock } from '@this/clocky';
import { Paths, Statter } from '@this/fs-util';
import { ByteCount, Duration } from '@this/quant';
import { BaseConfig } from '@this/structy';
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
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      /**
       * Path parts, or `null` if not yet calculated.
       *
       * @type {?object}
       */
      #pathParts = null;

      // @defaultConstructor

      /**
       * The various parts of {@link #path}. The return value is a frozen plain
       * object with the following properties:
       *
       * * `path` -- The original path (for convenience).
       * * `directory` -- The directory leading to the final path component,
       *   that is, everything but the final path component. This _not_ end with
       *   a slash, so in the case of a root-level file, this is the empty
       *   string.
       * * `fileName` -- The final path component.
       * * `filePrefix` -- The "prefix" portion of the file name, which is
       *   defined as everything up to but not including the last dot (`.`) in
       *   the name. If there is no dot in the name, then this is the same as
       *   `fileName`.
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
       * The absolute path to write to, with possible infixing of the final path
       * component, depending on the specific use case.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_path(value) {
        return Paths.checkAbsolutePath(value);
      }

      /**
       * Rotation configuration, or `null` not to do rotation. On input, this is
       * expected to be a plain object suitable to pass to
       * {@link BaseFileService#RotateConfig.constructor}.
       *
       * @param {?object} [value] Proposed configuration value. Default `null`.
       * @returns {?BaseFileService.RotateConfig} Accepted configuration value.
       */
      _config_rotate(value = null) {
        return (value === null)
          ? null
          : new BaseFileService.RotateConfig(value);
      }

      /**
       * File preservation configuration, or `null` not to do file preservation.
       * On input, this is expected to be a plain object suitable to pass to
       * {@link BaseFileService#SaveConfig.constructor}.
       *
       * @param {?object} [value] Proposed configuration value. Default `null`.
       * @returns {?BaseFileService.SaveConfig} Accepted configuration value.
       */
      _config_save(value = null) {
        return (value === null)
          ? null
          : new BaseFileService.SaveConfig(value);
      }

      /** @override */
      _impl_validate(config) {
        const { rotate, save } = config;

        if (rotate && save) {
          throw new Error('Cannot specify both `rotate` and `save`.');
        }

        // `rotate` is also used as a `save` config, so copy it to that
        // property.
        const result = rotate
          ? { ...config, save: rotate }
          : config;

        return super._impl_validate(result);
      }

      /**
       * Calculates the value for {@link #pathParts}.
       *
       * @returns {object} The split path, as described.
       */
      #makePathParts() {
        const { path } = this;

        const { directory, fileName } =
          path.match(/^(?<directory>.*)[/](?<fileName>[^/]+)$/).groups;

        const { filePrefix, fileSuffix = '' } =
          fileName.match(/^(?<filePrefix>.*?)(?<fileSuffix>[.][^.]*)?$/).groups;

        return Object.freeze({ path, directory, fileName, filePrefix, fileSuffix });
      }
    };
  }

  /**
   * Configuration class for `save` bindings.
   */
  static SaveConfig = class SaveConfig extends BaseConfig {
    // @defaultConstructor

    /**
     * The maximum size of old files to allow (in aggregate), or `null` to not
     * have such a size limit. if so limited. If passed as a string, it is
     * parsed by {@link ByteCount#parse}.
     *
     * @param {?string|ByteCount} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?ByteCount} Accepted configuration value.
     */
    _config_maxOldSize(value = null) {
      if (value === null) {
        return null;
      }

      const result = ByteCount.parse(value, { range: { minInclusive: 1 } });

      if (result === null) {
        throw new Error(`Could not parse \`maxOldSize\`: ${value}`);
      }

      return result;
    }

    /**
     * The maximum number of old files to allow, if so limited.
     *
     * @param {?number} [value] Proposed configuration value. Default `null`.
     * @returns {?number} Accepted configuration value.
     */
    _config_maxOldCount(value = null) {
      if (value === null) {
        return null;
      }

      return MustBe.number(value, { finite: true, minInclusive: 1 });
    }

    /**
     * Rotate when starting the system?
     *
     * @param {?boolean} [value] Proposed configuration value. Default `false`.
     * @returns {boolean} Accepted configuration value.
     */
    _config_onStart(value = false) {
      return MustBe.boolean(value);
    }

    /**
     * Rotate when stopping the system?
     *
     * @param {?boolean} [value] Proposed configuration value. Default `false`.
     * @returns {boolean} Accepted configuration value.
     */
    _config_onStop(value = false) {
      return MustBe.boolean(value);
    }
  };

  /**
   * Configuration class for `rotate` bindings.
   */
  static RotateConfig = class RotateConfig extends BaseFileService.SaveConfig {
    // @defaultConstructor

    /**
     * The file size at which to rotate, or `null` not to do rotation based on
     * file size. If passed as a string, it is parsed by
     * {@link ByteCount#parse}.
     *
     * @param {?string|ByteCount} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?ByteCount} Accepted configuration value.
     */
    _config_atSize(value = null) {
      if (value === null) {
        return null;
      }

      const result = ByteCount.parse(value, { range: { minInclusive: 1 } });

      if (result === null) {
        throw new Error(`Could not parse \`atSize\`: ${value}`);
      }

      return result;
    }

    /**
     * How often to check for rotation eligibility, if at all. If passed as a
     * string, it is parsed by {@link Duration#parse}.
     *
     * @param {?string|Duration} [value] Proposed configuration value. Default
     *   `'5 min'`.
     * @returns {?Duration} Accepted configuration value.
     */
    _config_checkPeriod(value = '5 min') {
      if (value === null) {
        return null;
      }

      const result = Duration.parse(value, { range: { minInclusive: 1 } });

      if (!result) {
        throw new Error(`Could not parse \`checkPeriod\`: ${value}`);
      }

      return result;
    }

    /** @override */
    _impl_validate(config) {
      const { atSize, checkPeriod } = config;

      if ((atSize === null) && (checkPeriod !== null)) {
        throw new Error('Configuring `checkPeriod` is not meaningful unless `atSize` is also used.');
      }

      return super._impl_validate(config);
    }
  };
}
