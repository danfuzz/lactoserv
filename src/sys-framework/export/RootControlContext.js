// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';

import { BaseComponent } from '#x/BaseComponent';
import { BaseControllable } from '#x/BaseControllable';
import { ControlContext } from '#x/ControlContext';
import { ThisModule } from '#p/ThisModule';


/**
 * Special context subclass which is _only_ used to represent the root of a
 * hierarchy.
 */
export class RootControlContext extends ControlContext {
  /**
   * @type {Map<string, ControlContext>} For each context which represents a
   * component (all of which have `name`s), a mapping from its name to the
   * context. This represents a subset of all descendants.
   */
  #components = new Map();

  /** @type {Set<ControlContext>} Set of all descendants. */
  #descendants = new Set();

  /**
   * Constructs an instance. It initially has no `associate`.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(logger) {
    super('root', null, logger);
  }

  /**
   * Registers a descendant with this instance.
   *
   * @param {ControlContext} descendant The descendant.
   */
  [ThisModule.SYM_addDescendant](descendant) {
    if (this.#descendants.has(descendant)) {
      throw new Error('Cannot register same descendant twice.');
    }

    const associate = descendant.associate;
    if (associate instanceof BaseComponent) {
      const name = associate.name;
      if (this.#components.has(name)) {
        throw new Error('Cannot register two different components with the same name.');
      }
      this.#components.set(name, descendant);
    }

    this.#descendants.add(descendant);
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
    this[ThisModule.SYM_linkRoot](root);
  }
}
