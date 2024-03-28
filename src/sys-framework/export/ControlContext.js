// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';
import { BaseControllable } from '#x/BaseControllable';
import { ThisModule } from '#p/ThisModule';


/**
 * Forward declaration of this subclass, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef RootControlContext
 * @type {ControlContext}
 */

/**
 * "Context" in which a {@link BaseControllable} is situated. Instances of this
 * class are handed to controllables via {@link BaseControllable#init}, which
 * gets called when they become hooked into a hierarchy of instances.
 */
export class ControlContext {
  /**
   * Logger to use, or `null` to not do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger;

  /**
   * Associated controllable instance. Is only ever
   * `null` for the context of the root instance itself, and only briefly while
   * it gets bootstrapped.
   *
   * @type {?BaseControllable}
   */
  #associate;

  /**
   * Instance which represents the parent (container)
   * of this instance's associated controllable, or `null` if this instance has
   * no parent (that is, is the root of the containership hierarchy).
   *
   * @type {?ControlContext}
   */
  #parent;

  /**
   * Instance which represents the root of the
   * containership hierarchy.
   *
   * @type {RootControlContext}
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
   * @param {?IntfLogger} [logger] Logger to use, or `null` to not do any
   *   logging.
   */
  constructor(associate, parent, logger = null) {
    this.#logger = logger;

    if (associate === 'root') {
      this.#associate = null; // Gets set in `linkRoot()`.
      this.#parent    = null; // ...and it stays that way.
      this.#root      = this;
    } else {
      this.#associate = MustBe.instanceOf(associate, BaseControllable);
      this.#parent    = MustBe.instanceOf(parent, BaseControllable).context;
      this.#root      = MustBe.instanceOf(this.#parent.#root, ControlContext);

      this.#root[ThisModule.SYM_addDescendant](this);
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
   * Gets a named component that has the same root as this instance, which must
   * also optionally be of a specific class (including a base class).
   *
   * @param {string} name Name of the component.
   * @param {?function(new:BaseComponent)} [cls] Class which the result must be
   *   an instance of, or `null` to not have a class restriction.
   * @returns {BaseComponent} Found instance.
   * @throws {Error} Thrown if a suitable instance was not found.
   */
  getComponent(name, cls) {
    return this.#root.getComponent(name, cls);
  }

  /**
   * Underlying implementation of the method `BaseControllable.linkRoot()`. This
   * is a module-private method, so that it can only be called when appropriate
   * (and thus avoid inconsistent state).
   *
   * @param {BaseControllable} root The actual "root" instance.
   */
  [ThisModule.SYM_linkRoot](root) {
    MustBe.instanceOf(root, BaseControllable);

    if (this.#root !== this) {
      throw new Error('Not a root instance.');
    } else if (root.context !== this) {
      throw new Error('Context mismatch.');
    } else if (this.#associate !== null) {
      throw new Error('Already linked.');
    }

    this.#associate = root;
  }
}
