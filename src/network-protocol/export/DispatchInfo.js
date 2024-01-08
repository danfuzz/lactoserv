// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { BaseConverter, Struct } from '@this/data-values';
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
   *   the request is being dispatched. This is expected to already have `.` and
   *   `..` components resolved away.
   * @param {TreePathKey} extra The remaining suffix portion of the original
   *   path, after removing `base`. This is expected to already have `.` and
   *   `..` components resolved away.
   */
  constructor(base, extra) {
    this.#base  = MustBe.instanceOf(base, TreePathKey);
    this.#extra = MustBe.instanceOf(extra, TreePathKey);
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
}
