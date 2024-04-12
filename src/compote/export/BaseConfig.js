// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { Names } from '#x/Names';


/**
 * Base class for configuration representation classes. Each concrete subclass
 * is expected to pass a plain object in its `super()` call which is suitable
 * for parsing by the base class. This (base) class defines a small handful of
 * core bindings, and it is up to each subclass to define other bindings
 * specific to the things-they-are-configuring.
 *
 * The bindings recognized by this class are:
 *
 * * `logTag` -- Optional string to use as a tag when logging. (TODO: This is
 *   going to be removed.)
 * * `name` -- Optional name for the component, for use when finding it in its
 *   hierarchy, and for use when logging. If non-`null`, it must adhere to the
 *   syntax defined by {@link Names#checkName}.
 */
export class BaseConfig {
  /**
   * Log tag (name) to use for the configured instance, or `null` for this
   * instance to not have a predefined tag.
   *
   * @type {?string}
   */
  #logTag;

  /**
   * The item's name, or `null` if it does not have a configured name.
   *
   * @type {?string}
   */
  #name;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object. See class header for
   *   details.
   * @param {boolean} [requireName] Is a `name` binding required?
   */
  constructor(rawConfig, requireName = false) {
    MustBe.plainObject(rawConfig);

    const { logTag = null, name = null } = rawConfig;

    if (requireName && (name === null)) {
      throw new Error('Missing `name` binding.');
    }

    this.#logTag = (logTag === null) ? null : MustBe.string(logTag);
    this.#name   = (name === null)   ? null : Names.checkName(name);
  }

  /**
   * @returns {?string} Log tag (name) to use for the configured instance, or
   * `null` for this instance to not have a predefined tag.
   */
  get logTag() {
    return this.#logTag;
  }

  /**
   * @returns {?string} The item's name, or `null` if it does not have a
   * configured name.
   */
  get name() {
    return this.#name;
  }
}
