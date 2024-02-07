// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import crypto from 'node:crypto';
import fs from 'node:fs/promises';

import { Paths, Statter } from '@this/fs-util';
import { MustBe } from '@this/typey';


/**
 * Configurable etag generator (e.g. for `ETag` headers).
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
   * @param {object} [options] Configuration options, or `null` to use all
   *   defaults.
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
  constructor(options = null) {
    options = EtagGenerator.expandOptions(options);

    this.#hashAlgorithm    = options.hashAlgorithm;
    this.#hashLengthStrong = options.hashLength.strong;
    this.#hashLengthWeak   = options.hashLength.weak;
    this.#tagForm          = options.tagForm;
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
   * Generates an etag from the contents of the given file. This returns `null`
   * if the file doesn't exist, and throws other file-related errors through to
   * the caller transparently.
   *
   * The returned etag is in the "strong" form, unless this instance was
   * configured with `tagForm: 'weak'`. (The actual hashing procedure is not
   * affected by the choice of returned form.)
   *
   * @param {string} absolutePath Absolute path to the file containing the
   *   entity data.
   * @returns {?string} The corresponding etag, or `null` if the file does not
   *   exist.
   */
  async etagFromFileData(absolutePath) {
    Paths.checkAbsolutePath(absolutePath);

    const stats = await Statter.statOrNull(absolutePath);
    if (!stats) {
      return null;
    } else if (!stats.isFile()) {
      throw new Error(`Cannot make etag from non-file: ${absolutePath}`);
    }

    const MAX_SIZE = EtagGenerator.#MAX_FILE_SIZE_TO_READ_ATOMICALLY;

    if (stats.size <= MAX_SIZE) {
      const data = await fs.readFile(absolutePath);
      return this.etagFromData(data);
    }

    // The file is too large to do in a single read.

    const hasher     = this.#newHasher();
    const buffer     = Buffer.alloc(MAX_SIZE);
    const fileHandle = await fs.open(absolutePath);

    try {
      loop: for (;;) {
        // Note: `read(buffer)` with no other arguments behaves incorrectly
        // prior to Node v21.6.
        const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length);
        switch (bytesRead) {
          case 0: {
            break loop;
          }
          case MAX_SIZE: {
            hasher.update(buffer);
            break;
          }
          default: {
            // Note: `subarray()` creates a shared-data view of the buffer.
            hasher.update(buffer.subarray(0, bytesRead));
            break;
          }
        }
      }
    } finally {
      await fileHandle.close();
    }

    return this.#etagResultFromHash(hasher.digest('base64'), true);
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
    Paths.checkAbsolutePath(absolutePath);

    // Converts a number (including bigint) to hex.
    const hex = (num) => {
      return (typeof num === 'number')
        ? Math.floor(num).toString(16)
        : num.toString(16);
    };

    const stats = await fs.stat(absolutePath, true);
    const mtime = stats.mtimeMs;
    const size  = stats.size;

    const toBeHashed = `${absolutePath}|${hex(mtime)}|${hex(size)}`;
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
    const tagForm = this.#tagForm;

    if ((tagForm === 'strong') || ((tagForm === 'vary') && isFullHash)) {
      return `"${hash.slice(0, this.#hashLengthStrong)}"`;
    } else {
      return `W/"${hash.slice(0, this.#hashLengthWeak)}"`;
    }
  }

  /**
   * Makes a fresh hasher per this instance's configuration.
   *
   * @returns {crypto.Hash} The new hasher.
   */
  #newHasher() {
    return crypto.createHash(this.#hashAlgorithm);
  }

  /**
   * Gets the raw configured hash result of the given data.
   *
   * @param {string|Buffer} data The data.
   * @returns {string} The raw hash result.
   */
  #rawHashFromData(data) {
    return this.#newHasher().update(data, 'utf8').digest('base64');
  }


  //
  // Static members
  //

  /** @type {number} Largest file to read in a single call. */
  static #MAX_FILE_SIZE_TO_READ_ATOMICALLY = 1024 * 1024; // One megabyte.

  /** @type {object} Per-algorithm length maximums. */
  static #MAX_HASH_LENGTHS = {
    'sha1':   27,
    'sha256': 43,
    'sha512': 86
  };

  /**
   * Checks constructor options for validity, and returns the "expanded" form
   * (where defaults are replaced with the corresponding true values).
   *
   * @param {*} options (Alleged) constructor options. `null` is treated as
   *   valid all-default options.
   * @returns {object} The expanded version of `options`, if `options` is valid.
   * @throws {Error} Thrown if there is trouble with `options`.
   */
  static expandOptions(options) {
    const {
      hashAlgorithm = 'sha256',
      hashLength    = null,
      tagForm       = 'vary'
    } = options ?? {};

    MustBe.string(hashAlgorithm, /^(sha1|sha256|sha512)$/);
    MustBe.string(tagForm, /^(strong|vary|weak)$/);

    if (typeof hashLength === 'number') {
      EtagGenerator.#checkHashLength(hashAlgorithm, hashLength);

      return {
        hashAlgorithm,
        hashLength: { strong: hashLength, weak: hashLength },
        tagForm
      };
    } else {
      const { strong = null, weak = 16 } = hashLength ?? {};

      EtagGenerator.#checkHashLength(hashAlgorithm, strong);
      EtagGenerator.#checkHashLength(hashAlgorithm, weak);

      return {
        hashAlgorithm,
        hashLength: {
          strong: EtagGenerator.#checkHashLength(hashAlgorithm, strong),
          weak:   EtagGenerator.#checkHashLength(hashAlgorithm, weak)
        },
        tagForm
      };
    }
  }

  /**
   * Checks a hash length value for validity, converting `null` into the actual
   * maximum.
   *
   * @param {string} hashAlgorithm The algorigthm.
   * @param {*} hashLength The alleged hash length.
   * @returns {number} `hashLength` if valid.
   */
  static #checkHashLength(hashAlgorithm, hashLength) {
    const max = this.#MAX_HASH_LENGTHS[hashAlgorithm];

    if (hashLength === null) {
      return max;
    } else {
      return MustBe.number(hashLength,
        { safeInteger: true, minInclusive: 8, maxInclusive: max });
    }
  }
}
