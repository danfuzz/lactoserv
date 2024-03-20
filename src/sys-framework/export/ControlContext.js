// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { BaseControllable } from '#x/BaseControllable';


/**
 * "Context" in which a {@link BaseControllable} is situated. Instances of this
 * class are handed to controllables via {@link BaseControllable#init}, which
 * gets called when they become hooked into a hierarchy of instances.
 */
export class ControlContext {
  /** @type {?IntfLogger} Logger to use, or `null` to not do any logging. */
  #logger;

  /**
   * @type {?BaseControllable} Associated controllable instance. Is only ever
   * `null` for the context of the root instance itself, and only briefly while
   * it gets bootstrapped.
   */
  #associate;

  /**
   * @type {?ControlContext} Instance which represents the parent (container)
   * of this instance's associated controllable, or `null` if this instance has
   * no parent (that is, is the root of the containership hierarchy).
   */
  #parent;

  /**
   * @type {ControlContext} Instance which represents the root of the
   * containership hierarchy.
   */
  #root;

  /**
   * Constructs an instance.
   *
   * @param {BaseControllable|string} associate Associated controllable
   *   instance, or the string `root` if this instance is to represent the root
   *   instance.
   * @param {?BaseControllable} parent Parent of `associate`, or `null` if this
   *   instance is to represent the root instance.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(associate, parent, logger) {
    this.#logger = logger;

    if (associate === 'root') {
      this.#associate = null; // Gets set in `linkRoot()`.
      this.#parent    = null; // ...and it stays that way.
      this.#root      = this;
    } else {
      this.#associate = MustBe.instanceOf(associate, BaseControllable);
      this.#parent    = MustBe.instanceOf(parent, BaseControllable).context;
      this.#root      = this.#parent.#root;
    }
  }

  /** @returns {BaseControllable} Associated controllable instance. */
  get associate() {
    return this.#associate;
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    return this.#logger;
  }

  /**
   * @returns {?ControlContext} Instance which represents the parent of this
   * instance's {@link #associate}, or `null` if this instance represents the
   * root of the containership hierarchy.
   */
  get parent() {
    return this.#parent;
  }

  /**
   * @returns {ControlContext} Instance which represents the root of the
   * containership hierarchy.
   */
  get root() {
    if (this.#root === null) {
      throw new Error('Root setup was incomplete.');
    }

    return this.#root;
  }

  /**
   * Sets up the {@link #associate} of this instance to be the indicated object.
   * This method is needed because it's impossible for the root to refer to
   * itself when trying to construct an instance of this class before calling
   * `super()` in its `constructor()` (due to JavaScript rules around references
   * to `this` in that context).
   *
   * @param {BaseControllable} root The actual "root" instance.
   */
  linkRoot(root) {
    MustBe.instanceOf(root, BaseControllable);

    if (this.#root !== this) {
      throw new Error('Not a root instance.');
    } else if (this.#associate !== null) {
      throw new Error('Already linked.');
    } else if (root.context !== this) {
      throw new Error('Context mismatch.');
    }

    this.#associate = root;
  }
}
