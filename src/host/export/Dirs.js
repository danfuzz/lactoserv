// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

/**
 * Utilities for getting at various local directories.
 */
export class Dirs {
  /** @type {URL} URL representing the base directory, if known. */
  static #baseDirUrl = null;

  /** @returns {string} The base directory of the application installation. */
  static get BASE_DIR() {
    return this.#BASE_DIR_URL.pathname;
  }

  /**
   * @returns {URL} URL representing the base directory. This is private because
   * URLs aren't immutable.
   */
  static get #BASE_DIR_URL() {
    if (this.#baseDirUrl === null) {
      // This assumes that the "closest" directory called `lib` lives in the
      // base directory.
      const here = import.meta.url;
      const pathParts = new URL(here).pathname.split('/');
      const codeAt = pathParts.findLastIndex((p) => p === 'lib');

      if (codeAt === -1) {
        throw new Error('Cannot find base directory from: ' + here);
      }

      this.#baseDirUrl =
        new URL('file://' + pathParts.slice(0, codeAt).join('/') + '/');
    }

    return this.#baseDirUrl;
  }

  /**
   * Concatenates the base directory with an indicated relative path.
   *
   * @param {string} relativePath Relative path from the base directory.
   * @returns {string} The concatenated path.
   */
  static basePath(relativePath) {
    return this.baseUrl(relativePath).pathname;
  }

  /**
   * Concatenates the base directory with an indicated relative path, yielding
   * an URL.
   *
   * @param {string} relativePath Relative path from the base directory.
   * @returns {URL} URL for the concatenated path.
   */
  static baseUrl(relativePath) {
    if (relativePath.startsWith('/')) {
      throw new Error('`relativePath` must be relative.');
    }

    return new URL(relativePath, Dirs.#BASE_DIR_URL);
  }
}
