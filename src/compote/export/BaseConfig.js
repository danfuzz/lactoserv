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
 * * `{?function(new:object)} class` -- The concrete class of the component to
 *   create, or `null` if the class is (going to be) implied by context (such as
 *   by passing an instance directly to the corresponding component
 *   constructor). This binding isn't required in general, but it _is_ required
 *   if the configuration instance gets used in a context where the concrete
 *   component class is not in fact implied.
 * * `name` -- Optional name for the component, for use when finding it in its
 *   hierarchy, and for use when logging. If non-`null`, it must adhere to the
 *   syntax defined by {@link Names#checkName}.
 */
export class BaseConfig {
  /**
   * The class of the item to create, or `null` if the class is expected to be
   * implied by context whenever this instance is used.
   *
   * @type {?function(new:object)}
   */
  #class;

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

    const { class: cls = null, name = null } = rawConfig;

    if (requireName && (name === null)) {
      throw new Error('Missing `name` binding.');
    }

    this.#class  = (cls === null)  ? null : MustBe.constructorFunction(cls);
    this.#name   = (name === null) ? null : Names.checkName(name);
  }

  /**
   * @returns {?function(new:object)} The class of the item to create, or `null`
   * if the class is expected to be implied by context whenever this instance is
   * used.
   */
  get class() {
    return this.#class;
  }

  /**
   * @returns {?string} The item's name, or `null` if it does not have a
   * configured name.
   */
  get name() {
    return this.#name;
  }
}
