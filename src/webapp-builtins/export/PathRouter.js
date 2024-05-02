// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey, TreeMap } from '@this/collections';
import { Names } from '@this/compy';
import { DispatchInfo, IntfRequestHandler, UriUtil } from '@this/net-util';
import { MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that routes requests based on incoming path prefixes, to one or
 * more of a set of configured sub-apps. See docs for configuration object
 * details.
 */
export class PathRouter extends BaseApplication {
  /**
   * Map which goes from a path prefix to a handler (typically a {@link
   * BaseApplication}) which should handle that prefix. Gets set in {@link
   * #_impl_start}.
   *
   * @type {?TreeMap<IntfRequestHandler>}
   */
  #routeTree = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    // Iterate from most- to least-specific mounted path.
    for (const pathMatch of this.#routeTree.findWithFallback(dispatch.extra)) {
      const application = pathMatch.value;
      const subDispatch = new DispatchInfo(
        dispatch.base.concat(pathMatch.key),
        pathMatch.keyRemainder);

      request.logger?.dispatchingPath({
        application: application.name,
        ...(subDispatch.infoForLog)
      });

      const result = await application.handleRequest(request, subDispatch);
      if (result !== null) {
        return result;
      }
      // `result === null`, so we iterate to try the next handler (if any).
    }

    return null;
  }

  /** @override */
  async _impl_init() {
    const routes = {};
    for (const [path, name] of this.config.paths) {
      routes[UriUtil.pathStringFrom(path)] = name;
    }

    this.logger?.routes(routes);
  }

  /** @override */
  async _impl_start() {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const appManager = this.root.applicationManager;
    const routeTree  = new TreeMap();

    for (const [path, name] of this.config.paths) {
      const app = appManager.get(name);
      routeTree.add(path, app);
    }

    this.#routeTree = routeTree;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseApplication.Config {
    // @defaultConstructor

    /**
     * Map which goes from a path prefix to the name of the application to
     * handle that prefix. Each path prefix must be a valid possibly-wildcarded
     * _absolute_ path prefix. Each name must be a valid component name, per
     * {@link Names#checkName}. On input, the value must be a plain object.
     *
     * @param {object} value Proposed configuration value.
     * @returns {TreeMap<string>} Accepted configuration value.
     */
    _config_paths(value) {
      MustBe.plainObject(value);

      const result = new TreeMap();

      for (const [path, name] of Object.entries(value)) {
        Names.checkName(name);
        const key = Config.#parsePath(path);
        result.add(key, name);
      }

      return result;
    }

    /**
     * Parses a path.
     *
     * @param {string} path The path to parse.
     * @returns {PathKey} The parsed form.
     */
    static #parsePath(path) {
      const parts = path.split('/');

      if (parts[0] !== '') {
        throw new Error(`Path must start with a slash: ${path}`);
      } else if (parts.length === 1) {
        throw new Error('Empty path.');
      }

      parts.shift(); // Shift away the necessarily-empty first part.

      let lastSpecial = null;

      switch (parts[parts.length - 1]) {
        case '': {
          lastSpecial = 'directory';
          parts.pop();
          break;
        }
        case '*': {
          lastSpecial = 'wildcard';
          parts.pop();
          break;
        }
      }

      for (const p of parts) {
        const error = (detail) => {
          detail = detail ? ` (${detail})` : '';
          return new Error(`Invalid path component \`${p}\`${detail} in: ${path}`);
        };

        switch (p) {
          case '': {
            throw error('empty');
          }
          case '.':
          case '..': {
            throw error('navigation');
          }
          case '*': {
            throw error('non-final wildcard');
          }
          default: {
            if (/^[*]+$/.test(p)) {
              throw error();
            } else if (!UriUtil.isPathComponent(p)) {
              throw error();
            }
          }
        }
      }

      switch (lastSpecial) {
        case 'directory': {
          return new PathKey([...parts, ''], false);
        }
        case 'wildcard': {
          return new PathKey([...parts], true);
        }
        default: {
          return new PathKey(parts, false);
        }
      }
    }
  };
}
