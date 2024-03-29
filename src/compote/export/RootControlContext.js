// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { Names } from '#x/Names';
import { ThisModule } from '#p/ThisModule';


/**
 * Special context subclass which is _only_ used to represent the root of a
 * hierarchy.
 */
export class RootControlContext extends ControlContext {
  /**
   * For each context which represents a component (all of which have `name`s),
   * a mapping from its name to the context. This represents a subset of all
   * descendants.
   *
   * @type {Map<string, ControlContext>}
   */
  #components = new Map();

  /**
   * Set of all descendants.
   *
   * @type {Set<ControlContext>}
   */
  #descendants = new Set();

  /**
   * Constructs an instance. It initially has no `associate`.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(logger) {
    super('root', null, logger);
  }

  /** @override */
  getComponent(name, cls) {
    MustBe.string(name);
    cls = (cls === null) ? Object : MustBe.constructorFunction(cls);

    const found = this.#components.get(name)?.associate;

    if (!found) {
      throw new Error(`No such component: ${name}`);
    } else if (!(found instanceof cls)) {
      throw new Error(`Component not of class ${cls.name}: ${name}`);
    }

    return found;
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
    const name      = associate.name;

    if (name !== null) {
      Names.checkName(name);
      if (this.#components.has(name)) {
        throw new Error('Cannot register two different components with the same name.');
      }
      this.#components.set(name, descendant);
    }

    this.#descendants.add(descendant);
  }
}
