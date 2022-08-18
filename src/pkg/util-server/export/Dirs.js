// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as url from 'url';

/**
 * Utilities for getting at various local directories.
 */
export class Dirs {
  static #baseDir = null;

  /** {string} The base directory of the application installation. */
  static get BASE_DIR() {
    if (Dirs.#baseDir == null) {
      Dirs.#baseDir = Dirs.#findBaseDir();
    }

    return Dirs.#baseDir;
  }

  /**
   * Determines the value for {@link #BASE_DIR}.
   *
   * @returns {string} The base directory.
   */
  static #findBaseDir() {
    // This assumes that the "closest" directory called `code` lives in the base
    // directory.
    const here = import.meta.url;
    const pathParts = new URL(here).pathname.split('/');
    const codeAt = pathParts.findLastIndex((p) => p == 'code');

    if (codeAt == -1) {
      throw new Error('Cannot find base directory from: ' + here);
    }

    return pathParts.slice(0, codeAt).join('/');
  }
}
