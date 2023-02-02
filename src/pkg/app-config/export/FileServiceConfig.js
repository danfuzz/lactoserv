// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs/promises';
import * as Path from 'node:path';

import { Files } from '#x/Files';
import { ServiceConfig } from '#x/ServiceConfig';


/**
 * Common superclass for service configurations that write one or more files to
 * a particular directory.
 *
 * Accepted configuration bindings (in the constructor). All are required:
 *
 * * `{string} baseName` -- The base file name of the file(s) to write,
 *   including a suffix (e.g. `.txt`) if wanted. Must be a simple name (no
 *   directories).
 * * `{string} directory` -- The directory to write files to. Must be an
 *   absolute path (not relative).
 *
 * This class includes some utility functionality beyond just accessing the
 * configured values.
 */
export class FileServiceConfig extends ServiceConfig {
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
   * @param {object} config Configuration object.
   */
  constructor(config) {
    super(config);

    this.#baseName  = Files.checkFileName(config.baseName);
    this.#directory = Files.checkAbsolutePath(config.directory);

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
   * Resolves the {@link #directory} and {@link #baseName} to an absolute path.
   * If the optional `extraPrefix` is given, includes that in the name as with
   * {@link #baseNameWithExtraPrefix}.
   *
   * @param {string} [extraPrefix = null] String to append to the prefix, if
   *   any.
   * @returns {string} The fully resolved path.
   */
  resolvePath(extraPrefix = null) {
    const baseName = extraPrefix
      ? this.baseNameWithExtraPrefix(extraPrefix)
      : this.#baseName;

    return Path.resolve(this.#directory, baseName);
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
