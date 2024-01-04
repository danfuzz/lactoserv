// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';

import { Request } from '#x/Request';


/**
 * A {@link Request}, plus dispatch information.
 *
 * In Express, the non-`Request` information held by this class is bolted onto
 * the `express.Request` object. In this system, we instead keep it separate,
 * aiming for maximum immutability of the objects (even if we don't quite
 * achieve it).
 */
export class DispatchRequest {
  /** @type {Request} The underlying request. */
  #request;

  /** @type {TreePathKey} The base path. */
  #base;

  /** @type {TreePathKey} The remaining suffix portion of the path. */
  #extra;

  /**
   * Constructs an instance.
   *
   * **Note:** This class makes no attempt to verify that the given `base` and
   * `extra` correspond to the original request's full `pathname`.
   *
   * @param {Request} request Original request.
   * @param {TreePathKey} base The base path (that is, the path prefix) to which
   *   the request is being dispatched.
   * @param {TreePathKey} extra The remaining suffix portion of the original
   *   path, after removing `base`.
   */
  constructor(request, base, extra) {
    this.#request = MustBe.instanceOf(request, Request);
    this.#base    = MustBe.instanceOf(base, TreePathKey);
    this.#extra   = MustBe.instanceOf(extra, TreePathKey);
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
      : TreePathKey.uriPathStringFrom(this.#base, false);
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
    return TreePathKey.uriPathStringFrom(this.#extra);
  }

  /** @returns {Request} The original request. */
  get request() {
    return this.#request;
  }
}
