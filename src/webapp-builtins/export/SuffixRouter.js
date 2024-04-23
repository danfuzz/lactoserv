// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfRequestHandler } from '@this/net-util';
import { MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that routes requests based on the suffix of the file path, to one
 * or more of a set of configured sub-apps. See docs for configuration object
 * details.
 */
export class SuffixRouter extends BaseApplication {
  /**
   * Map which goes from a file name suffix (the actual suffix text, not the
   * spec with `*` prefix) to the handler (typically a {@link BaseApplication})
   * which should handle that suffix. Gets set in {@link #_impl_start}.
   *
   * @type {?Map<string, IntfRequestHandler>}
   */
  #routeMap = null;

  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    if (dispatch.isDirectory()) {
      if (!this.config.handleDirectories) {
        return null;
      }
    } else {
      if (!this.config.handleFiles) {
        return null;
      }
    }

    const name   = dispatch.lastName;
    const suffix = name.match(this.config.suffixMatcher)?.[0] ?? null;

    if (suffix === null) {
      return null;
    }

    const application = this.#routeMap.get(suffix);

    request.logger?.dispatchingSuffix({
      application: application.name,
      suffix
    });

    return application.handleRequest(request, dispatch);
  }

  /** @override */
  async _impl_init() {
    const routes = {};
    for (const [suffix, name] of this.config.routeMap) {
      routes[`*${suffix}`] = name;
    }

    this.logger?.routes(routes);
  }

  /** @override */
  async _impl_start() {
    // Note: We can't do this setup in `_impl_init()` because it might not be
    // the case that all of the referenced apps have already been added when
    // that runs.

    const appManager = this.root.applicationManager;
    const routeMap   = new Map();

    for (const [suffix, name] of this.config.routeMap) {
      const app = appManager.get(name);
      routeMap.set(suffix, app);
    }

    this.#routeMap = routeMap;
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
    /**
     * Like the outer `routeMap` except with names instead of handler instances.
     *
     * @type {Map<string, string>}
     */
    #routeMap;

    /**
     * Regular expression which matches the longest handled suffix of a given
     * file name. This ends up having a form along the lines of
     * `/(?<!^)(?:(?:[.]bar)|(?:[.]baz)|(?:-bar[.]baz)|(?:))$/`.
     *
     * @type {RegExp}
     */
    #suffixMatcher;

    /**
     * Should directory paths get matched?
     *
     * @type {boolean}
     */
    #handleDirectories;

    /**
     * Should file paths (non-directories) get matched?
     *
     * @type {boolean}
     */
    #handleFiles;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        handleDirectories = false,
        handleFiles       = true,
        suffixes
      } = rawConfig;

      MustBe.plainObject(suffixes);

      this.#handleDirectories = MustBe.boolean(handleDirectories);
      this.#handleFiles       = MustBe.boolean(handleFiles);

      const routeMap   = new Map();
      const regexParts = [];

      for (const [suffix, name] of Object.entries(suffixes)) {
        const { text, regex } = Config.#parseSuffix(suffix);
        if (routeMap.has(text)) {
          throw new Error(`Duplicate suffix spec: ${suffix}`);
        }
        routeMap.set(text, name);
        regexParts.push(regex);
      }

      this.#routeMap      = routeMap;
      this.#suffixMatcher = new RegExp(`(?<!^)(?:${regexParts.join('|')})$`);
    }

    /**
     * @returns {Map<string, string>} Like the outer `routeMap` except with
     * names instead of handler instances.
     */
    get routeMap() {
      return this.#routeMap;
    }

    /**
     * @returns {RegExp} Regular expression which matches the longest handled
     * suffix of a given file name.
     */
    get suffixMatcher() {
      return this.#suffixMatcher;
    }

    /** @returns {boolean} Should directory paths get matched? */
    get handleDirectories() {
      return this.#handleDirectories;
    }

    /** @returns {boolean} Should file paths (non-directories) get matched? */
    get handleFiles() {
      return this.#handleFiles;
    }

    /**
     * Parses a suffix specifier.
     *
     * @param {string} spec The suffix specifier to parse.
     * @returns {{ text: string, regex: string }} The parsed form, including the
     *   pure text and regex-matching fragment.
     */
    static #parseSuffix(spec) {
      if (spec === '*') {
        // This is easier than trying to shoehorn a match of just `*` into the
        // `spec.match(...)` below.
        return { text: '', regex: '(?:)' };
      }

      const text = spec.match(/(?<=^[*])[-._+][-._+A-Za-z0-9]+$/)?.[0] ?? null;

      if (text === null) {
        if (text === '') {
          throw new Error('Suffix match specs cannot be empty; maybe you mean `*`?');
        } else if (!text.startsWith('*')) {
          throw new Error(`Not a valid suffix match spec (must start with \`*\`): ${spec}`);
        } else {
          throw new Error(`Not a valid suffix match spec: ${spec}`);
        }
      }

      const chars = [];
      for (const c of text) {
        switch (c) {
          case '.':
          case '+': {
            // Escape regex syntax characters.
            chars.push(`[${c}]`);
            break;
          }
          default: {
            chars.push(c);
          }
        }
      }

      const regex = `(?:${chars.join('')})`;

      return { text, regex };
    }
  };
}
