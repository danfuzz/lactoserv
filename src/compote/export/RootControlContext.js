// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { AskIf, MustBe } from '@this/typey';

import { ControlContext } from '#x/ControlContext';
import { Names } from '#x/Names';
import { ThisModule } from '#p/ThisModule';


/**
 * Special context subclass which is _only_ used to represent the root of a
 * hierarchy.
 */
export class RootControlContext extends ControlContext {
  /**
   * For each context which represents a _named_ component, a mapping from its
   * name to the context. This represents a subset of all descendants.
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
  getComponentOrNull(name, ...classes) {
    if ((name === null) || (name === undefined)) {
      return null;
    }

    MustBe.string(name);
    MustBe.arrayOf(classes, AskIf.constructorFunction);

    const found = this.#components.get(name)?.associate;

    if (!found) {
      return null;
    }

    if (classes.length !== 0) {
      const ifaces = found.implementedInterfaces;
      for (const cls of classes) {
        if (!((found instanceof cls) || ifaces.includes(cls))) {
          if (classes.length === 1) {
            throw new Error(`Component \`${name}\` not of expected class: ${classes[0].name}`);
          } else {
            const names = `[${classes.map((c) => c.name).join(', ')}]`;
            throw new Error(`Component \`${name}\` not of expected classes: ${names}`);
          }
        }
      }
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
