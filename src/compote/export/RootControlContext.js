// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathMap, TreePathKey } from '@this/collections';
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
  #contextTree = new TreePathMap();

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

  /**
   * @returns {TreePathMap} The full tree of all descendant contexts.
   */
  get [ThisModule.SYM_contextTree]() {
    return this.#contextTree;
  }

  /** @override */
  getComponentOrNull(path, ...classes) {
    path = Names.parsePathOrNull(path);

    if (!path) {
      return null;
    }

    MustBe.arrayOf(classes, AskIf.constructorFunction);

    const found = this.#contextTree.get(path)?.associate;

    if (!found) {
      return null;
    }

    if (classes.length !== 0) {
      const ifaces = found.implementedInterfaces;
      for (const cls of classes) {
        if (!((found instanceof cls) || ifaces.includes(cls))) {
          const errPrefix = `Component \`${Names.pathStringFrom(path)}\` not of expected`;
          if (classes.length === 1) {
            throw new Error(`${errPrefix} class: ${classes[0].name}`);
          } else {
            const names = `[${classes.map((c) => c.name).join(', ')}]`;
            throw new Error(`${errPrefix} classes: ${names}`);
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
      throw new Error('Cannot register same component twice.');
    }

    const associate = descendant.associate;
    const name      = associate.name;

    if (name !== null) {
      Names.checkName(name);
      if (this.#components.has(name)) {
        throw new Error(`Cannot register two components with the same name: ${name}`);
      }
      this.#components.set(name, descendant);
    }

    this.#descendants.add(descendant);
  }
}
