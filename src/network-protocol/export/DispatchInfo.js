// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';

import { Request } from '#x/Request';


/**
 * Dispatch information related to a {@link Request}.
 *
 * In Express, the non-`Request` information held by this class is bolted onto
 * the `express.Request` object. In this system, we instead keep it separate,
 * aiming for maximum immutability of the objects (even if we don't quite
 * achieve it).
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
   *   the request is being dispatched.
   * @param {TreePathKey} extra The remaining suffix portion of the original
   *   path, after removing `base`.
   */
  constructor(base, extra) {
    this.#base  = MustBe.instanceOf(base, TreePathKey);
    this.#extra = MustBe.instanceOf(extra, TreePathKey);
  }

  /**
   * @returns {TreePathKey} The base path (that is, the path prefix) to which
   * the request is being dispatched.
   */
  get base() {
    return this.#base;
  }

  /**
   * @returns {string} {@link #base}, as a path string. If it is actually an
   * empty (zero-length) key, this returns the empty string (`''`), which
   * maintains an invariant that concatenating {@link #baseString} and {@link
   * #extraString} yields the original request's `pathnameString`.
   */
  get baseString() {
    const base = this.#base;

    // `false` == don't append `/*` for a wildcard `TreePathKey` instance.
    return (base.length === 0)
      ? ''
      : this.#base.toUriPathString(false);
  }

  /**
   * @returns {TreePathKey} The remaining suffix portion of the path, after
   * removing {@link #base}.
   */
  get extra() {
    return this.#extra;
  }

  /** @returns {string} {@link #extra}, as a path string. */
  get extraString() {
    // `false` == don't append `/*` for a wildcard `TreePathKey` instance.
    return this.#extra.toUriPathString(false);
  }
}
