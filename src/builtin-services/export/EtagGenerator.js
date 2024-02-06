// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { Files, ServiceConfig } from '@this/app-config';
import { BaseService } from '@this/app-framework';
import { Duration, Moment } from '@this/data-values';
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
   * @type {Map <string|Buffer, string>}} Map from a cacheable entity value to
   * its already-known etag.
   */
  #dataCache = new Map();

  /**
   * @type {Map <string, {fullDataEtag: string, stats: fs.BigIntStats,
   * statsEtag: string, statsEtagUntil: Moment, fullHash}>}} Map from an
   * absolute path to all of:
   *
   * * `fullDataEtag` -- The full data etag, if calculated.
   * * `stats` -- the most-recently gathered stats (a `BigIntStats`, though as
   *   of Node v21 one can't actually name that type in code).
   * * `statsEtag` -- its already-known stats-based etag.
   * * `statsEtagUntil` -- The expiration moment of the stats-based etag.
   */
  #statsCache = new Map();

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

    const cacheable = Object.isFrozen(data);

    if (cacheable) {
      const already = this.#dataCache.get(data);
      if (already) {
        return already;
      }
    }

    const hash   = this.#rawHashFromData(data);
    const result = this.#etagResultFromHash(hash, true);

    if (cacheable) {
      if (this.#dataCache.size >= EtagGenerator.#MAX_CACHE_SIZE) {
        // TODO: Be smarter.
        this.#dataCache.clear();
      }
      this.#dataCache.set(data, result);
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

    // What's going on with the cache here: We make a "live" (not cached) stats
    // check, and if the file doesn't appear to be modified, we return the
    // previously-calculated tag.

    // TODO
    throw new Error('TODO');
  }

  /**
   * Generates an etag from the `Stats` of a particular file.
   *
   * The returned etag is in the "weak" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hash value is not affected
   * by the choice of returned form.)
   *
   * @param {string} absolutePath Absolute path to the file associated with the
   *   entity.
   * @returns {string} The corresponding etag.
   */
  async etagFromFileStats(absolutePath) {
    Files.checkAbsolutePath(absolutePath);

    // Converts a number (including bigint) to hex.
    const hex = (num) => {
      return (typeof num === 'number')
        ? Math.floor(num).toString(16)
        : num.toString(16);
    };

    const now     = Moment.fromMsec(Date.now());
    const already = this.#statsCache.get(absolutePath);

    if (already && now.isBefore(already.statsEtagUntil)) {
      return already.statsEtag;
    }

    const stats = await fs.stat(absolutePath, true);
    const inode = stats.ino;
    const mtime = stats.mtimeMs;
    const size  = stats.size;

    const toBeHashed =
      `${absolutePath}|${hex(inode)}|${hex(mtime)}|${hex(size)}`;
    const hash   = this.#rawHashFromData(toBeHashed);
    const result = this.#etagResultFromHash(hash, false);

    if (this.#statsCache.size >= EtagGenerator.#MAX_CACHE_SIZE) {
      // TODO: Be smarter.
      this.#statsCache.clear();
    }

    this.#statsCache.set(absolutePath, {
      stats,
      statsEtag:      result,
      statsEtagUntil: now.add(EtagGenerator.#STATS_VALIDITY_DURATION)
    });

    return result;
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

  /**
   * Gets the raw configured hash result of the given data.
   *
   * @param {string|Buffer} data The data.
   * @returns {string} The raw hash result.
   */
  #rawHashFromData(data) {
    return crypto.createHash(this.config.hashAlgorithm)
      .update(data, 'utf8')
      .digest('base64');
  }


  //
  // Static members
  //

  /** @type {number} The largest size the cache is allowed to be. */
  static #MAX_CACHE_SIZE = 100;

  /** @type {Duration} How long stats-based etags are considered valid for. */
  static #STATS_VALIDITY_DURATION = new Duration(60); // One minute.

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
