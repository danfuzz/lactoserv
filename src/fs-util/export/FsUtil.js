// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { MustBe } from '@this/typey';


/**
 * General filesystem utility class.
 */
export class FsUtil {
  /**
   * Checks to see if the given path exists in the filesystem, and is a
   * directory (not a regular or special file).
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async directoryExists(path) {
    const stats = await this.#statOrNull(path);

    return stats && stats.isDirectory();
  }

  /**
   * Checks to see if the given path exists in the filesystem, and is a regular
   * file (not a directory or special file).
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async fileExists(path) {
    const stats = await this.#statOrNull(path);

    return stats && stats.isFile();
  }

  /**
   * Checks to see if the given path exists in the filesystem.
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async pathExists(path) {
    const stats = await this.#statOrNull(path);

    return (stats !== null);
  }

  /**
   * Checks to see if the given path exists in the filesystem, and is a socket.
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async socketExists(path) {
    const stats = await this.#statOrNull(path);

    return stats && stats.isSocket();
  }

  /**
   * Gets the `fs.Stats` of the path if it exists, or returns `null` if the
   * path does not exist in the filesystem.
   *
   * @param {string} path Path to check.
   * @returns {?fs.Stats} The stats, if the path exists, or `null` if not.
   */
  static async #statOrNull(path) {
    MustBe.string(path);

    try {
      return await fs.stat(path);
    } catch (e) {
      if (e.code === 'ENOENT') {
        // Not found. Not a real error in this case.
        return null;
      }
      throw e;
    }
  }
}
