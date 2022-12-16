// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as fs from 'node:fs';

import { Dirs } from '#x/Dirs';


/**
 * Utilities for getting at top-level product info.
 */
export class ProductInfo {
  /** @type {?object} Info extracted from `package.json`. */
  static #info = null;

  /** @returns {object} All product info. */
  static get allInfo() {
    this.#extractInfo();
    return { ...this.#info };
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
  }

  /**
   * Extracts the salient info from the main `package.json` file, if not yet
   * done.
   */
  static #extractInfo() {
    if (this.#info) {
      return;
    }

    let parsed;

    try {
      const packageUrl = Dirs.baseUrl('package.json');
      const text       = fs.readFileSync(packageUrl);
      parsed = JSON.parse(text);
    } catch {
      parsed = {};
    }

    const rawName = parsed.name ?? '';
    const version = parsed.version ?? '0.0.1';
    const name    = rawName.match(/top-of-(?<name>[^/]+)/)?.groups.name ?? '<unknown>';

    this.#info = { name, version };
  }
}
