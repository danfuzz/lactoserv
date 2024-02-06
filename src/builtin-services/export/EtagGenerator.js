// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService } from '@this/app-framework';
import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Service which provides a standardized way to generate `ETag`s, along with
 * optional caching of same.
 *
 * TODO: Cache control.
 *
 * Configuration object details:
 *
 * * `{?string} hashAlgorithm` -- Algorithm to use to generate hashes from
 *   entity data. Allowed to be `sha1`, `sha256`, or `sha512`. Defaults to
 *   `sha256`.
 * * `{?number} strongLength` -- Number of characters to actually use from a
 *   generated hash, when producing a strong-form etag. Each character
 *   represents 6 bits of original hash (because hashes are extracted as
 *   base64-encoded values). Defaults to the full length of the hash.
 * * `{?string} tagForm` -- What tag form to produce etags in (indicating the
 *   "strength" of the tag), one of `weak`, `strong`, or `vary`. "Strong" etags
 *   are meant to convey that the entire underlying data is hashed into the tag,
 *   and as such it is safe to make range requests if a tag matches. "Weak" tags
 *   are, on the other hand, intended to indicate that the data was not fully
 *   hashed into the tag. If passed as `vary`, the methods return the arguably
 *   most appropriate form (and are documented as to what they produce). The
 *   default is `vary`.
 * * `{?number} weakLength` -- Number of characters to actually use from a
 *   generated hash, when producing a weak-form etag. Defaults to `16`.
 */
export class EtagGenerator extends BaseService {
  /**
   * {Map <string|Buffer, string>}} Map from a cacheable entity value to its
   * already-known etag.
   */
  #cache = new Map();

  /**
   * Constructs an instance.
   *
   * @param {ServiceConfig} config Configuration for this service.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    // TODO -- Maybe don't need this constructor?
  }

  /**
   * Generates an etag from a buffer or string. If given a string, the hash is
   * generated from the UTF-8 encoded bytes of the string.
   *
   * The returned etag is in the "strong" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hash value is not affected
   * by the choice of returned form.)
   *
   * @param {string|Buffer} data The entity data in question. `Buffer`s must be
   *   frozen in order to be cached.
   * @returns {string} The corresponding etag.
   */
  async etagFromData(data) {
    if (typeof data !== 'string') {
      MustBe.instanceOf(data, Buffer);
    }

    const config    = this.config;
    const cacheable = Object.isFrozen(data);

    if (cacheable) {
      const already = this.#cache.get(data);
      if (already) {
        return already;
      }
    }

    const hash = crypto.createHash(config.hashAlgorithm)
      .update(data, 'utf8')
      .digest('base64');

    const result = this.#etagResultFromHash(hash, true);

    if (cacheable) {
      if (this.#cache.size > EtagGenerator.#MAX_CACHE_SIZE) {
        // TODO: Be smarter.
        this.#cache.clear();
      }
      this.#cache.set(data, result);
    }

    return result;
  }

  /**
   * Generates an etag from the contents of the given file.
   *
   * The returned etag is in the "strong" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hash value is not affected
   * by the choice of returned form.)
   *
   * @param {string} absolutePath Absolute path to the file containing the
   *   entity data.
   * @returns {string} The corresponding etag.
   */
  async etagFromFileData(absolutePath) {
    Files.checkAbsolutePath(absolutePath);

    // TODO
    throw new Error('TODO');
  }

  /**
   * Generates an etag from the `Stats` of a particular file. If the stats are
   * already known, they can be passed so as to avoid redundant filesystem
   * access.
   *
   * The returned etag is in the "weak" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hash value is not affected
   * by the choice of returned form.)
   *
   * @param {string} absolutePath Absolute path to the file associated with the
   *   entity.
   * @param {?fs.Stats|fs.BigIntStats} [stats] Stats to base the tag on, if
   *   already available.
   * @returns {string} The corresponding etag.
   */
  async etagFromFileStats(absolutePath, stats = null) {
    Files.checkAbsolutePath(absolutePath);

    // TODO
    throw new Error('TODO', stats);
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // TODO

    this.logger.running();
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // TODO

    this.logger.stopped();
  }

  /**
   * Constructs a final etag result from a hash and a strength indicator.
   *
   * @param {string} hash The hash.
   * @param {boolean} isFullHash Is it a full data hash?
   * @returns {string} The final result.
   */
  #etagResultFromHash(hash, isFullHash) {
    const config  = this.config;
    const tagForm = config.tagForm;

    if ((tagForm === 'strong') || ((tagForm === 'vary') && isFullHash)) {
      return `"${hash.slice(0, config.strongHashLength)}"`;
    } else {
      return `W/"${hash.slice(0, config.weakHashLength)}"`;
    }
  }


  //
  // Static members
  //

  /** @type {number} The largest size the cache is allowed to be. */
  static #MAX_CACHE_SIZE = 100;

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends ServiceConfig {
    /** @type {string} The hash algorithm. */
    #hashAlgorithm;

    /**
     * @returns {?number} The number of characters to use from the hash for a
     * strong-form tag, or `null` to to use the whole thing.
     */
    #strongHashLength;

    /**
     * @returns {string} The generated tag form, one of `strong`, `vary`, or
     * `weak`.
     */
    #tagForm;

    /**
     * @returns {?number} The number of characters to use from the hash for a
     * weak-form tag.
     */
    #weakHashLength;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        hashAlgorithm    = 'sha256',
        strongHashLength = null,
        tagForm          = 'vary',
        weakHashLength   = 16
      } = config;

      MustBe.string(hashAlgorithm, /^(sha1|sha256|sha512)$/);
      MustBe.string(tagForm, /^(strong|vary|weak)$/);

      if (strongHashLength !== null) {
        MustBe.number(strongHashLength,
          { safeInteger: true, minInclusive: 8, maxInclusive: 100 });
      }

      MustBe.number(weakHashLength,
        { safeInteger: true, minInclusive: 8, maxInclusive: 100 });

      this.#hashAlgorithm    = hashAlgorithm;
      this.#strongHashLength = strongHashLength;
      this.#tagForm          = tagForm;
      this.#weakHashLength   = weakHashLength;
    }

    /** @returns {string} The hash algorithm. */
    get hashAlgorithm() {
      return this.#hashAlgorithm;
    }

    /**
     * @returns {?number} The number of characters to use from the hash for a
     * strong-form tag, or `null` to to use the whole thing.
     */
    get strongHashLength() {
      return this.#strongHashLength;
    }

    /**
     * @returns {string} The generated tag form, one of `strong`, `vary`, or
     * `weak`.
     */
    get tagForm() {
      return this.#tagForm;
    }

    /**
     * @returns {?number} The number of characters to use from the hash for a
     * weak-form tag.
     */
    get weakHashLength() {
      return this.#weakHashLength;
    }
  };
}
