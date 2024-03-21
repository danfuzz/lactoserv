// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey, TreePathMap } from '@this/collections';
import { DispatchInfo, HttpUtil } from '@this/net-util';
import { Names } from '@this/sys-config';
import { BaseApplication } from '@this/sys-framework';
import { MustBe } from '@this/typey';


/**
 * Application that routes requests based on incoming path prefixes, to one or
 * more of a set of configured sub-apps. See docs for configuration object
 * details.
 */
export class PathRouter extends BaseApplication {
  /**
   * @type {?TreePathMap<BaseApplication>} Map which goes from a path prefix to
   * an app which should handle that prefix. Gets set in {@link #_impl_start}.
   */
  #routeTree = null;

  // Note: The default constructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    // Iterate from most- to least-specific mounted path.
    for (let pathMatch = this.#routeTree.find(dispatch.extra, true);
      pathMatch;
      pathMatch = pathMatch.next) {
      const application = pathMatch.value;
      const subDispatch = new DispatchInfo(
        dispatch.base.concat(pathMatch.key),
        pathMatch.keyRemainder);

      request.logger?.dispatchingPath({
        application: application.name,
        base:        subDispatch.baseString,
        extra:       subDispatch.extraString
      });

      const result = await application.handleRequest(request, dispatch);
      if (result !== null) {
        return result;
      }
      // `result === null`, so we iterate to try the next handler (if any).
    }

    return null;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // Nothing needed here for this class.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const context   = this.context;
    const routeTree = new TreePathMap();

    for (const [path, name] of this.config.routeTree) {
      const app = context.getComponent(name, BaseApplication);
      routeTree.add(path, app);
    }

    this.#routeTree = routeTree;
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return this.#Config;
  }

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseApplication.FilterConfig {
    /**
     * @type {TreePathMap<string>} Like the outer `routeTree` except with names
     * instead of application instances.
     */
    #routeTree;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const { paths } = config;

      MustBe.plainObject(paths);

      const routeTree = new TreePathMap();

      for (const [path, name] of Object.entries(paths)) {
        Names.checkName(name);
        const key = Config.#parsePath(path);
        routeTree.add(key, name);
      }

      this.#routeTree = routeTree;
    }

    /**
     * @returns {TreePathMap<string>} Like the outer `routeTree` except with
     * names instead of application instances.
     */
    get routeTree() {
      return this.#routeTree;
    }

    /**
     * Parses a path.
     *
     * @param {string} path The path to parse.
     * @returns {TreePathKey} The parsed form.
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
        switch (p) {
          case '': {
            throw new Error(`Empty path component in: ${path}`);
          }
          case '.':
          case '..': {
            throw new Error(`Invalid path component \`${p}\` in: ${path}`);
          }
          case '*': {
            throw new Error(`Non-final \`*\` in path: ${path}`);
          }
          default: {
            if (!/^[-_.a-zA-Z0-9]+$/.test(p)) {
              throw new Error(`Invalid path component \`${p}\` in: ${path}`);
            }
          }
        }
      }

      switch (lastSpecial) {
        case 'directory': {
          return new TreePathKey([...parts, ''], false);
        }
        case 'wildcard': {
          return new TreePathKey([...parts], true);
        }
        default: {
          return new TreePathKey(parts, false);
        }
      }
    }
  };
}
