// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { Files } from '@this/app-config';
import { MustBe } from '@this/typey';


/**
 * Configurable etag generator (e.g. for `ETag` headers).
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
export class EtagGenerator {
  /** @type {string} The hash algorithm. */
  #hashAlgorithm;

  /**
   * @type {?number} The number of characters to use from the hash for strong
   * etags.
   */
  #hashLengthStrong;

  /**
   * @type {?number} The number of characters to use from the hash for weak
   * etags.
   */
  #hashLengthWeak;

  /** @type {string} The generated tag form. */
  #tagForm;

  /**
   * Constructs an instance.
   *
   * @param {object} options Configuration options.
   * @param {?string} [options.hashAlgorithm] Algorithm to use to generate
   *   hashes. Allowed to be `sha1`, `sha256`, or `sha512`. Defaults to
   *  `sha256`.
   * @param {?number|object} [options.hashLength] Number of characters to use
   *   from a generated hash when producing an etag. To have different lengths
   *   for strong vs. weak etags, specify this as an object with `strong` and
   *   `weak` properties. In object form, a `null` mapping indicates that the
   *   full hash length is to be used. Defaults to `{ strong: null, weak: 16}`.
   * @param {?string} [options.tagForm] What etag form to produce (indicating
   *   the "strength" of the tag), one of `weak`, `strong`, or `vary`. "Strong"
   *   etags are meant to convey that the entire underlying data is hashed into
   *   the tag, and as such it is safe to make range requests if a tag matches.
   *   "Weak" tags are, on the other hand, intended to indicate that the data
   *   was not fully hashed into the tag. If passed as `vary`, the methods
   *   return the arguably most appropriate form (and are documented as to what
   *   they produce). Defaults to `vary`.
   */
  constructor(options) {
    const {
      hashAlgorithm = 'sha256',
      hashLength    = null,
      tagForm       = 'vary'
    } = options;

    MustBe.string(hashAlgorithm, /^(sha1|sha256|sha512)$/);
    MustBe.string(tagForm, /^(strong|vary|weak)$/);

    this.#hashAlgorithm = hashAlgorithm;
    this.#tagForm       = tagForm;

    if (typeof hashLength === 'number') {
      EtagGenerator.#checkHashLength(hashLength);
      this.#hashLengthStrong = hashLength;
      this.#hashLengthWeak   = hashLength;
    } else {
      const { strong = null, weak = 16 } = hashLength ?? {};
      this.#hashLengthStrong = EtagGenerator.#checkHashLength(strong);
      this.#hashLengthWeak   = EtagGenerator.#checkHashLength(weak);
    }
  }

  /**
   * Generates an etag from a buffer or string. If given a string, the hash is
   * generated from the UTF-8 encoded bytes of the string.
   *
   * The returned etag is in the "strong" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hashing procedure is not
   * affected by the choice of returned form.)
   *
   * @param {string|Buffer} data The entity data in question. `Buffer`s must be
   *   frozen in order to be cached.
   * @returns {string} The corresponding etag.
   */
  async etagFromData(data) {
    if (typeof data !== 'string') {
      MustBe.instanceOf(data, Buffer);
    }

    const hash = this.#rawHashFromData(data);

    return this.#etagResultFromHash(hash, true);
  }

  /**
   * Generates an etag from the contents of the given file.
   *
   * The returned etag is in the "strong" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hashing procedure is not
   * affected by the choice of returned form.)
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
   * configured with `tagForm: 'weak'`. (The actual hashing procedure is not
   * affected by the choice of returned form.)
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

    const stats = await fs.stat(absolutePath, true);
    const inode = stats.ino;
    const mtime = stats.mtimeMs;
    const size  = stats.size;

    const toBeHashed = `${absolutePath}|${hex(inode)}|${hex(mtime)}|${hex(size)}`;
    const hash       = this.#rawHashFromData(toBeHashed);

    return this.#etagResultFromHash(hash, false);
  }

  /**
   * Constructs a final etag result from a hash and a strength indicator.
   *
   * @param {string} hash The hash.
   * @param {boolean} isFullHash Is `hash` a full data hash?
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

  /**
   * Checks a hash length value for validity.
   *
   * @param {*} hashLength The alleged hash length.
   * @returns {?number} `hashLength` if valid.
   */
  static #checkHashLength(hashLength) {
    if (hashLength !== null) {
      MustBe.number(hashLength,
        { safeInteger: true, minInclusive: 8, maxInclusive: 100 });
    }

    return hashLength;
  }
}
