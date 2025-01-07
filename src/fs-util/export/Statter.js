// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';

import { MustBe } from '@this/typey';


/**
 * Utilities to do useful stuff around calls to `stat()` and similar.
 */
export class Statter {
  /**
   * Checks to see if the given path exists in the filesystem, and is a
   * directory (not a regular or special file).
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async directoryExists(path) {
    const stats = await this.statOrNull(path);

    return stats ? stats.isDirectory() : false;
  }

  /**
   * Checks to see if the given path exists in the filesystem, and is a regular
   * file (not a directory or special file).
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async fileExists(path) {
    const stats = await this.statOrNull(path);

    return stats ? stats.isFile() : false;
  }

  /**
   * Checks to see if the given path exists in the filesystem, and is of any
   * type (regular file, directory, named socket, etc.).
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async pathExists(path) {
    const stats = await this.statOrNull(path);

    return (stats !== null);
  }

  /**
   * Checks to see if the given path exists in the filesystem, and is a socket.
   *
   * @param {string} path Path to check.
   * @returns {boolean} The answer.
   */
  static async socketExists(path) {
    const stats = await this.statOrNull(path);

    return stats ? stats.isSocket() : false;
  }

  /**
   * Gets the `fs.Stats` of the path if it exists, or returns `null` if the path
   * does not exist in the filesystem. "Not existing" includes, notably, the
   * case where a non-final path component (that is, something which ought to be
   * a directory) exists but is _not_ a directory.
   *
   * @param {string} path Path to check.
   * @returns {?fs.Stats} The stats, if the path exists, or `null` if not.
   */
  static async statOrNull(path) {
    MustBe.string(path);

    try {
      return await fs.stat(path);
    } catch (e) {
      // Return `null` for errors which indicate that the file wasn't found.
      switch (e.code) {
        case 'ENOENT':    // Some path component wasn't found.
        case 'ENOTDIR': { // A non-final path component isn't a directory.
          return null;
        }
      }
      throw e;
    }
  }
}
