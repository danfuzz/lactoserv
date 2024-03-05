// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { BaseConverter, Struct } from '@this/data-values';
import { MustBe } from '@this/typey';

import { IncomingRequest } from '#x/IncomingRequest';


/**
 * Dispatch information related to an {@link IncomingRequest}.
 *
 * The idea here is that {@link IncomingRequest} objects are treated in a way
 * that's as immutable as possible (even if we don't quite achieve it), so we
 * need somewhere -- that is, instances of this class -- to hold the ephemera of
 * the request dispatch process.
 */
export class DispatchInfo {
  /** @type {TreePathKey} The base path. */
  #base;

  /** @type {TreePathKey} The remaining suffix portion of the path. */
  #extra;

  /**
   * Constructs an instance.
   *
   * @param {TreePathKey} base The base path (that is, the path prefix) to which
   *   the request is being dispatched. This is expected to already have `.` and
   *   `..` components resolved away. This must not end with an empty component,
   *   though it _can_ be entirely empty (which corresponds to a dispatched
   *   mount point at the root of a host).
   * @param {TreePathKey} extra The remaining suffix portion of the original
   *   path, after removing `base`. This is expected to already have `.` and
   *   `..` components resolved away.
   */
  constructor(base, extra) {
    this.#base  = MustBe.instanceOf(base, TreePathKey);
    this.#extra = MustBe.instanceOf(extra, TreePathKey);

    const baseLen = base.length;

    if ((baseLen !== 0) && (base.path[baseLen - 1] === '')) {
      throw new Error('`base` must not end with an empty component.');
    }
  }

  /**
   * Standard `data-values` method to produce an encoded version of this
   * instance.
   *
   * @returns {Struct} The encoded form.
   */
  [BaseConverter.ENCODE]() {
    return new Struct(DispatchInfo, null, this.#base, this.#extra);
  }

  /**
   * @returns {TreePathKey} The base path (that is, the path prefix) to which
   * the request is being dispatched.
   */
  get base() {
    return this.#base;
  }

  /**
   * @returns {string} {@link #base}, as a path string. It is always prefixed
   * with a slash (`/`) and only ends with a slash if the final path component
   * is empty.
   */
  get baseString() {
    // `false` == don't append `/*` for a wildcard `TreePathKey` instance.
    return this.#base.toUriPathString(false);
  }

  /**
   * @returns {TreePathKey} The remaining suffix portion of the path, after
   * removing {@link #base}.
   */
  get extra() {
    return this.#extra;
  }

  /**
   * @returns {string} {@link #extra}, as a path string. It is always prefixed
   * with a slash (`/`) and only ends with a slash if the final path component
   * is empty.
   */
  get extraString() {
    // `false` == don't append `/*` for a wildcard `TreePathKey` instance.
    return this.#extra.toUriPathString(false);
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
   * Gets a relative redirect path which refers to {@link #extra} as a
   * file. This property is always `../<last>` where `<last>` is the last
   * file component of the full path, _except_ if the full path is entirely
   * empty, in which case it is `/`, which is about as good as we can do (even
   * though it is in directory form).
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
   * empty component?
   *
   * @returns {boolean} `true` if this instance is in directory form, or `false`
   *   if not.
   */
  isDirectory() {
    const lastComponent = this.lastComponent;
    return (lastComponent === null) || (lastComponent === '');
  }
}
