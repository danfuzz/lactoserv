// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey, TreeMap } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { BaseConfig } from '@this/structy';

import { ControlContext } from '#x/ControlContext';
import { Names } from '#x/Names';
import { ThisModule } from '#p/ThisModule';


/**
 * Special context subclass which is _only_ used to represent the root of a
 * hierarchy.
 */
export class RootControlContext extends ControlContext {
  /**
   * The configuration object for the root component. This notably contains
   * logging-related info needed by this class.
   *
   * @type {BaseConfig}
   */
  #rootConfig;

  /**
   * Tree which maps each component path to its context instance.
   *
   * @type {TreeMap<ControlContext>}
   */
  #contextTree = new TreeMap();

  /**
   * Constructs an instance. It initially has no `associate`.
   *
   * @param {BaseConfig} config Root component configuration.
   */
  constructor(config) {
    super('root', null);

    this.#rootConfig = config;
  }

  /**
   * @returns {?IntfLogger} The "root" logger to use, that is, the logger from
   * which all loggers in this hierarchy derive, or `null` if this whole
   * hierarchy is _not_ doing logging at all.
   */
  get rootLogger() {
    return this.#rootConfig.rootLogger;
  }

  /**
   * @returns {TreeMap} The full tree of all descendant contexts.
   */
  get [ThisModule.SYM_contextTree]() {
    return this.#contextTree;
  }

  /** @override */
  getComponentElseNull(path, ...classes) {
    path = Names.parsePossiblyNullPath(path);

    if (!path) {
      return null;
    }

    const found = this.#contextTree.get(path)?.associate;

    if (!found) {
      return null;
    } else if (found.instanceOfAll(...classes)) {
      return found;
    }

    const errPrefix = `Component \`${Names.pathStringFrom(path)}\` not of expected`;
    if (classes.length === 1) {
      throw new Error(`${errPrefix} class: ${classes[0].name}`);
    } else {
      const names = `[${classes.map((c) => c.name).join(', ')}]`;
      throw new Error(`${errPrefix} classes: ${names}`);
    }
  }

  /**
   * Gets the logger to use for the given component path.
   *
   * @param {PathKey} componentPath The component path.
   * @returns {?IntfLogger} The logger, or `null` if the indicated component
   *   should not do logging.
   */
  getLoggerForPath(componentPath) {
    const rootLogger = this.rootLogger;

    if (!rootLogger) {
      return null;
    }

    const loggingMap = this.#rootConfig.logging;

    if (loggingMap) {
      const found = loggingMap.find(componentPath);
      if (found?.value === false) {
        // The match indicates that logging should be off for this component.
        return null;
      }
    }

    let logger = rootLogger;

    for (const k of componentPath.path) {
      logger = logger[k];
    }

    return logger;
  }
}
