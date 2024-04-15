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
  /**
   * The "root" logger to use, or `null` if the hierarchy isn't doing logging at
   * all.
   *
   * @type {?IntfLogger}
   */
  #rootLogger;

  /**
   * Tree which maps each component path to its context instance.
   *
   * @type {TreePathMap<ControlContext>}
   */
  #contextTree = new TreePathMap();

  /**
   * Constructs an instance. It initially has no `associate`.
   *
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(logger) {
    super('root', null, logger);

    this.#rootLogger = logger;
  }

  /**
   * @returns {?IntfLogger} The "root" logger to use, that is, the logger from
   * which all loggers in this hierarchy derive, or `null` if this whole
   * hierarchy is _not_ doing logging at all.
   */
  get rootLogger() {
    return this.#rootLogger;
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
}
