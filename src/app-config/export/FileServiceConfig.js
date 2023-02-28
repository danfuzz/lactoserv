// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { Files } from '#x/Files';
import { RotateConfig } from '#x/RotateConfig';
import { ServiceConfig } from '#x/ServiceConfig';


/**
 * Common superclass for service configurations that write one or more files to
 * a particular directory.
 *
 * Accepted configuration bindings (in the constructor):
 *
 * * `{string} path` -- Filesystem path indicating the directory to write to,
 *   and if being used to name files, the base file name. Must be an absolute
 *   path (not relative). Required.
 * * `{?object} rotate` -- Optional plain object which can be parsed as a
 *   file-rotation configuration spec, or `null` for no rotation configuration.
 *   See {@link #RotateConfig} for details.
 *
 * This class includes some utility functionality beyond just accessing the
 * configured values.
 */
export class FileServiceConfig extends ServiceConfig {
  /** @type {string} The absolute path to use. */
  #path;

  /** @type {?RotateConfig} Rotation configuration, if any. */
  #rotate;

  /** @type {string} The base file name to use. */
  #baseName;

  /** @type {string} The directory to write to. */
  #directory;

  /** @type {string} The base file name's prefix. */
  #basePrefix;

  /** @type {string} The base file name's suffix. */
  #baseSuffix;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const path = Files.checkAbsolutePath(config.path);

    // Split the path into a directory and base name.
    const match = path.match(/^(?<directory>.*[/])(?<baseName>[^/]+)$/);
    if (!match) {
      // Shouldn't happen, in that `checkAbsolutePath()` should have caught any
      // problems.
      throw new Error(`Shouldn't happen; strange path: ${path}`);
    }

    this.#baseName  = match.groups.baseName;
    this.#directory = match.groups.directory;
    this.#path      = path;
    this.#rotate    = config.rotate ? new RotateConfig(config.rotate) : null;

    const { prefix, suffix } = FileServiceConfig.#parseBaseName(this.#baseName);
    this.#basePrefix = prefix;
    this.#baseSuffix = suffix;
  }

  /**
   * @returns {string} The prefix of {@link #baseName}. This is the part of the
   * name from the start up to (but not including) the last dot (`.`). If there
   * is no dot, then this is the same as {@link #baseName}.
   */
  get basePrefix() {
    return this.#basePrefix;
  }

  /** @returns {string} The base file name to use. */
  get baseName() {
    return this.#baseName;
  }

  /**
   * @returns {string} The suffix of {@link #baseName}. This is the part of the
   * name from (and including) the last dot (`.`) to the end of the string. If
   * there is no dot, then this is the empty string (`''`).
   */
  get baseSuffix() {
    return this.#baseSuffix;
  }

  /** @returns {string} The directory to write to. */
  get directory() {
    return this.#directory;
  }

  /**
   * @returns {string} The absolute path to write to (with possible infixing of
   * the final path component, depending on the specific use case).
   */
  get path() {
    return this.#path;
  }

  /** @returns {?RotateConfig} Rotation configuration, if any. */
  get rotate() {
    return this.#rotate;
  }

  /**
   * Constructs a base name consisting of the original but with a new string
   * appended to the prefix. That is, this is a convenient shorthand for
   * `basePrefix + extraPrefix + baseSuffix`.
   *
   * @param {string} extraPrefix String to append to the prefix.
   * @returns {string} The combined name.
   */
  baseNameWithExtraPrefix(extraPrefix) {
    return `${this.#basePrefix}${extraPrefix}${this.#baseSuffix}`;
  }

  /**
   * Creates the {@link #directory}, if it doesn't already exist.
   */
  async createDirectoryIfNecessary() {
    try {
      await fs.stat(this.#directory);
    } catch (e) {
      if (e.code === 'ENOENT') {
        await fs.mkdir(this.#directory, { recursive: true });
      } else {
        throw e;
      }
    }
  }

  /**
   * Produces a modified {@link #path} by infixing the final path component with
   * the given value.
   *
   * @param {string} infix String to infix into the final path component.
   * @returns {string} The so-modified path.
   */
  infixPath(infix) {
    const split = this.splitPath();
    return `${split.directory}/${split.filePrefix}${infix}${split.fileSuffix}`;
  }

  /**
   * Splits the {@link #path} into components. The return value is a plain
   * object with the following properties:
   *
   * * `path` -- The original path (for convenience).
   * * `directory` -- The directory leading to the final path component, that
   *   is, everything but the final path component. This _not_ end with a slash,
   *   so in the case of a root-level file, this is the empty string.
   * * `fileName` -- The final path component.
   * * `filePrefix` -- The "prefix" portion of the file name, which is defined
   *   as everything up to but not including the last dot (`.`) in the name. If
   *   there is no dot in the name, then this is the same as `fileName`.
   * * `fileSuffix` -- The "suffix" portion of the file name, which is
   *   everything not included in `filePrefix`. If there is no dot in the name,
   *   then this is the empty string.
   *
   * @returns {object} The split path, as described.
   */
  splitPath() {
    const path = this.#path;

    const { directory, fileName } =
      path.match(/^(?<directory>.*)[/](?<fileName>[^/]+)$/).groups;

    const { filePrefix, fileSuffix = '' } =
      fileName.match(/^(?<filePrefix>.*?)(?<fileSuffix>[.][^.]*)?$/).groups;

    return { path, directory, fileName, filePrefix, fileSuffix };
  }


  //
  // Static members
  //

  /**
   * Parses a base file name into a main part and a suffix.
   *
   * @param {string} baseName The original base name.
   * @returns {{ base: string, suffix: string }} The parsed parts.
   */
  static #parseBaseName(baseName) {
    const { prefix, suffix = '' } =
      baseName.match(/^(?<prefix>.*?)(?<suffix>[.][^.]*)?$/).groups;

    return { prefix, suffix };
  }
}
