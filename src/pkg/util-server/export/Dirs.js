// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as url from 'url';

/**
 * Utilities for getting at various local directories.
 */
export class Dirs {
  /** {URL} URL representing the base directory, if known. */
  static #baseDirUrl = null;

  /** {string} The base directory of the application installation. */
  static get BASE_DIR() {
    return Dirs.#BASE_DIR_URL.pathname;
  }

  /** {URL} URL representing the base directory. This is private because URLs
   * aren't immutable.
   */
  static get #BASE_DIR_URL() {
    if (Dirs.#baseDirUrl == null) {
      // This assumes that the "closest" directory called `code` lives in the
      // base directory.
      const here = import.meta.url;
      const pathParts = new URL(here).pathname.split('/');
      const codeAt = pathParts.findLastIndex((p) => p == 'code');

      if (codeAt == -1) {
        throw new Error('Cannot find base directory from: ' + here);
      }

      Dirs.#baseDirUrl =
        new URL('file://' + pathParts.slice(0, codeAt).join('/') + '/');
    }

    return Dirs.#baseDirUrl;
  }

  /**
   * Concatenates the base directory with an indicated relative path.
   *
   * @param {string} relativePath Relative path from the base directory.
   * @returns {string} The concatenated path.
   */
  static basePath(relativePath) {
    if (relativePath.startsWith('/')) {
      throw new Error('`relativePath` must be relative.');
    }

    return new URL(relativePath, Dirs.#BASE_DIR_URL).pathname;
  }
}
