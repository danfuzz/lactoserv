// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';

import { Dirs } from '#x/Dirs';
import { ThisModule } from '#p/ThisModule';


/**
 * Utilities for getting at top-level product info.
 */
export class ProductInfo {
  /** @type {?object} Info extracted from `product-info.json`. */
  static #info = null;

  /** @returns {object} All product info. */
  static get allInfo() {
    this.#extractInfo();

    // `{ ... }` to clone the object, so that the caller can safely modify it.
    return { ...this.#info };
  }

  /** @returns {string} Commit info. */
  static get commit() {
    this.#extractInfo();
    return this.#info.commit;
  }

  /** @returns {string} Main product name. */
  static get name() {
    this.#extractInfo();
    return this.#info.name;
  }

  /** @returns {string} Main product version. */
  static get version() {
    this.#extractInfo();
    return this.#info.version;
  }

  /**
   * Initializes this class.
   */
  static init() {
    this.#extractInfo();
    ThisModule.logger.productInfo(this.#info);
  }

  /**
   * Extracts the salient info from the main `package.json` file, if not yet
   * done.
   */
  static #extractInfo() {
    if (this.#info) {
      return;
    }

    const info = {
      name:    '<unknown>',
      version: '<unknown>',
      commit:  '<unknown>'
    };

    try {
      const productUrl = Dirs.baseUrl('product-info.json');
      const text       = fs.readFileSync(productUrl);
      Object.assign(info, JSON.parse(text));
    } catch (e) {
      // Ignore it, other than logging.
      ThisModule.logger.productInfoError(e);
    }

    process.title = `node :: ${info.name} ${info.version} ${info.commit}`
      .replaceAll(/ <unknown>/g, '');

    this.#info = info;
  }
}
