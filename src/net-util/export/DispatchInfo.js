// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { IntfDeconstructable } from '@this/decon';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { IncomingRequest } from '#x/IncomingRequest';
import { UriUtil } from '#x/UriUtil';


/**
 * Dispatch information related to an {@link IncomingRequest}.
 *
 * The idea here is that {@link IncomingRequest} objects are treated in a way
 * that's as immutable as possible (even if we don't quite achieve it), so we
 * need somewhere -- that is, instances of this class -- to hold the ephemera of
 * the request dispatch process.
 */
export class DispatchInfo extends IntfDeconstructable {
  /**
   * The base path.
   *
   * @type {PathKey}
   */
  #base;

  /**
   * The remaining suffix portion of the path.
   *
   * @type {PathKey}
   */
  #extra;

  /**
   * The dipatch logger, or `null` if none.
   *
   * @type {?IntfLogger}
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {PathKey} base The base path (that is, the path prefix) to which the
   *   request is being dispatched. This is expected to already have `.` and
   *   `..` components resolved away.
   * @param {PathKey} extra The remaining suffix portion of the original path,
   *   after removing `base`. This is expected to already have `.` and `..`
   *   components resolved away.
   * @param {?IntfLogger} [logger] Logger to use for dispatch-related logging,
   *   or `null` not to do dispatch logging.
   */
  constructor(base, extra, logger = null) {
    super();

    this.#base   = MustBe.instanceOf(base, PathKey);
    this.#extra  = MustBe.instanceOf(extra, PathKey);
    this.#logger = (logger === null) ? null : MustBe.callableFunction(logger);
  }

  /** @override */
  deconstruct() {
    return [DispatchInfo, this.#base, this.#extra];
  }

  /**
   * @returns {PathKey} The base path (that is, the path prefix) to which
   * the request is being dispatched.
   */
  get base() {
    return this.#base;
  }

  /**
   * @returns {PathKey} The remaining suffix portion of the path, after
   * removing {@link #base}.
   */
  get extra() {
    return this.#extra;
  }

  /**
   * @returns {number} The combined lengths of {@link #base} and {@link #extra}.
   */
  get fullPathLength() {
    return this.#base.length + this.#extra.length;
  }

  /**
   * @returns {?string} The last path component of the combination of
   * `<base>/<extra>`, or `null` if both are empty (have length `0`).
   */
  get lastComponent() {
    const length = this.fullPathLength;

    return (length === 0) ? null : this.getFullPathComponent(length - 1);
  }

  /**
   * @returns {?string} The last path component of the combination of
   * `<base>/<extra>` if it is non-empty, the second-to-last if the last is
   * empty, or `null` if neither of the previous two conditions are meaningful
   * (becuase the total path length is less than `2`). The idea is that this is
   * the "file name" of this instance, whether it represents a regular file _or_
   * a directory.
   */
  get lastName() {
    const length = this.fullPathLength;

    switch (length) {
      case 0: {
        return null;
      }
      case 1: {
        const name = this.getFullPathComponent(0);
        return (name === '') ? null : name;
      }
      default: {
        const last = this.getFullPathComponent(length - 1);
        return (last === '')
          ? this.getFullPathComponent(length - 2)
          : last;
      }
    }
  }

  /**
   * @returns {?IntfLogger} The dipatch logger, or `null` if none.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * @returns {object} Contents of this instance as a plain object with simple
   * data properties, suitable for logging. The result is slightly ambiguous in
   * the face of unusual input, because paths are rendered as slash-separated
   * strings.
   */
  get infoForLog() {
    return {
      base:  UriUtil.pathStringFrom(this.#base),
      extra: UriUtil.pathStringFrom(this.#extra, true) // `true` == relative.
    };
  }

  /**
   * Gets a relative redirect path which refers to {@link #extra} as a
   * directory. If `extra` is _already_ a directory reference -- that is, it
   * ends with an empty component -- this property is `./`.
   *
   * @returns {string} The relative redirect string, as described above.
   */
  get redirectToDirectoryString() {
    const lastComponent = this.lastComponent;

    return ((lastComponent === null) || (lastComponent === ''))
      ? './' // Already a directory (or the root).
      : `./${lastComponent}/`;
  }

  /**
   * Gets a relative redirect path which refers to {@link #extra} as a file.
   * This property is always `../<last>` where `<last>` is the last file
   * component of the full path, _except_ if the full path is entirely empty, in
   * which case it is `/`, which is about as good as we can do (even though it
   * is in directory form).
   *
   * @returns {string} The relative redirect string, as described above.
   */
  get redirectToFileString() {
    const lastComponent = this.lastComponent;

    if (lastComponent === null) {
      // The whole path is just `/` (the root).
      return '/';
    } else if (lastComponent === '') {
      const length = this.fullPathLength;
      const last2  = (length >= 2) ? this.getFullPathComponent(length - 2) : null;

      return (last2 === null)
        ? '/'
        : `../${last2}`;
    } else {
      return `../${lastComponent}`;
    }
  }

  /**
   * Gets the Nth component of the combination of `<base>/<extra>`.
   *
   * @param {number} n Which component to get. Must be a valid index into the
   *   combination.
   * @returns {string} The indicated component.
   */
  getFullPathComponent(n) {
    MustBe.number(n, { safeInteger: true, minInclusive: 0, maxExclusive: this.fullPathLength });

    const base    = this.#base;
    const baseLen = base.length;

    return (n < baseLen)
      ? base.path[n]
      : this.#extra.path[n - baseLen];
  }

  /**
   * Does this instance name a directory? That is, does `extra` end with an
   * empty component? This is the opposite of {@link #isFile}.
   *
   * @returns {boolean} `true` if this instance is in directory form, or `false`
   *   if not.
   */
  isDirectory() {
    const lastComponent = this.lastComponent;
    return (lastComponent === null) || (lastComponent === '');
  }

  /**
   * Does this instance name a file? That is, does `extra` end with a non-empty
   * component? This is the opposite of {@link #isDirectory}.
   *
   * @returns {boolean} `true` if this instance is in file form, or `false` if
   *   not.
   */
  isFile() {
    return !this.isDirectory();
  }

  /**
   * Gets a new instance which is just like this one, except with a replacement
   * for `logger`.
   *
   * @param {?IntfLogger} [logger] Logger to use, if any.
   * @returns {DispatchInfo} An appropriately-constructed instance.
   */
  withLogger(logger) {
    return new DispatchInfo(this.#base, this.#extra, logger);
  }

  /**
   * Gets a new instance which is just like this one, except with replacements
   * for `base` and `extra`.
   *
   * @param {PathKey} base The base path.
   * @param {PathKey} extra The path suffix.
   * @returns {DispatchInfo} An appropriately-constructed instance.
   */
  withPaths(base, extra) {
    return new DispatchInfo(base, extra, this.#logger);
  }
}
