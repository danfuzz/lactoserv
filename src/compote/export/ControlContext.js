// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { IntfComponent } from '#x/IntfComponent';
import { ThisModule } from '#p/ThisModule';


/**
 * Forward declaration of this subclass, because `import`ing it would cause a
 * circular dependency while loading.
 *
 * @typedef RootControlContext
 * @type {ControlContext}
 */

/**
 * "Context" in which a {@link IntfComponent} is situated. Instances of this
 * class are handed to controllables via {@link IntfComponent#init}, which gets
 * called when they become hooked into a hierarchy of instances.
 */
export class ControlContext {
  /**
   * Logger to use, or `null` to not do any logging.
   *
   * @type {?IntfLogger}
   */
  #logger;

  /**
   * Associated controllable instance. Is only ever `null` for the context of
   * the root instance itself, and only briefly while it gets bootstrapped.
   *
   * @type {?IntfComponent}
   */
  #associate;

  /**
   * Instance which represents the parent (container) of this instance's
   * associated controllable, or `null` if this instance has no parent (that is,
   * is the root of the containership hierarchy).
   *
   * @type {?ControlContext}
   */
  #parent;

  /**
   * Instance which represents the root of the containership hierarchy.
   *
   * @type {RootControlContext}
   */
  #root;

  /**
   * Constructs an instance.
   *
   * @param {IntfComponent|string} associate Associated component instance, or
   *   the string `root` if this instance is to represent the root instance.
   * @param {?IntfComponent} parent Parent of `associate`, or `null` if this
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
      // TODO: We should figure out how to type-check interfaces.
      this.#associate = associate;
      this.#parent    = MustBe.instanceOf(parent.context, ControlContext);
      this.#root      = MustBe.instanceOf(this.#parent.#root, /*Root*/ControlContext);

      this.#root[ThisModule.SYM_addDescendant](this);
    }
  }

  /** @returns {IntfComponent} Associated controllable instance. */
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
   * @param {...function(new:IntfComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {IntfComponent} Found instance.
   * @throws {Error} Thrown if a suitable instance was not found.
   */
  getComponent(name, ...classes) {
    const result = this.#root.getComponentOrNull(name, ...classes);

    if (result === null) {
      throw new Error(`No such component: ${name}`);
    }

    return result;
  }

  /**
   * Like {@link #getComponent}, but returns `null` if there is no component
   * with the indicated name or if `name` was passed as `null` or `undefined`.
   * If there _is_ a component with the name but its class doesn't match, that's
   * still an error.
   *
   * @param {?string} name Name of the component, or `null`-ish to always
   *   not-find an instance.
   * @param {...function(new:IntfComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {?IntfComponent} Found instance, or `null` if there was none.
   * @throws {Error} Thrown if a suitable instance was not found.
   */
  getComponentOrNull(name, ...classes) {
    return this.#root.getComponentOrNull(name, ...classes);
  }

  /**
   * Underlying implementation of the method `BaseComponent.linkRoot()`. This is
   * a module-private method, so that it can only be called when appropriate
   * (and thus avoid inconsistent state).
   *
   * @param {IntfComponent} root The actual "root" instance.
   */
  [ThisModule.SYM_linkRoot](root) {
    // TODO: We should figure out how to type-check interfaces.
    // MustBe.instanceOf(root, IntfComponent);

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
