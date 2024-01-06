// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { TreePathKey } from '@this/collections';
import { FsUtil } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { DispatchInfo } from '@this/network-protocol';


/**
 * Static content server. See docs for configuration object details.
 *
 * This class will refuse to serve (error `404`) URLs which:
 * * Contain `..` components which would "back out" of the root directory.
 * * Contain an _encoded_ slash in them, that is to say literally `%2F`, because
 *   the underlying filesystem API doesn't have any way to specify a path
 *   _component_ which contains a slash.
 * * Contain an internal empty path component (`...//...`), again because the
 *   filesystem API doesn't understand those as names (and we are being
 *   conservative in that we'd rather report an error than wade blithely into
 *   DWIM territory).
 * * End with an empty path component (that is, end with a slash), if the path
 *   does _not_ correspond to a readable directory.
 */
export class StaticFiles extends BaseApplication {
  /**
   * @type {?string} Path to the file to serve for a not-found result, or
   * `null` if not-found handling shouldn't be done.
   */
  #notFoundPath;

  /** @type {string} Absolute path to the base directory of files to serve. */
  #siteDirectory;

  /** @type {function(...*)} "Middleware" handler function for this instance. */
  #staticMiddleware;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    const { notFoundPath, siteDirectory } = config;

    this.#notFoundPath     = notFoundPath;
    this.#siteDirectory    = siteDirectory;
    this.#staticMiddleware = express.static(siteDirectory);
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const resolved = await this.#resolvePath(dispatch);

    this.logger?.RESOLVED(resolved);

    if (!resolved) {
      this.logger?.NOT_FOUND();
      if (this.#notFoundPath) {
        request.expressResponse.status(404).sendFile(this.#notFoundPath);
        return await BaseApplication.whenEnded(request);
      } else {
        return false;
      }
    }

    if (resolved.redirect) {
      // TODO: Use request.redirect.
      // request.redirect(301, xxxxx)
      const redirectTo = resolved.redirect;
      this.logger?.wouldRedirect(dispatch, redirectTo);
    }

    // TODO: Just use sendFile, I think?
    const result =
      await BaseApplication.callMiddleware(request, dispatch, this.#staticMiddleware);

    return result;
  }

  /** @override */
  async _impl_start(isReload_unused) {
    const { notFoundPath, siteDirectory } = this.config;

    if (!await FsUtil.directoryExists(siteDirectory)) {
      throw new Error(`Not found or not a directory: ${siteDirectory}`);
    }

    if (notFoundPath) {
      if (!await FsUtil.fileExists(notFoundPath)) {
        throw new Error(`Not found or not a file: ${notFoundPath}`);
      }
    }
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // Nothing to do here.
  }

  /**
   * Figures out the absolute path to serve for the given request path.
   *
   * @param {DispatchInfo} dispatch Dispatch info containing the path to serve.
   * @returns {{path: string, stats: fs.Stats}|{redirect: TreePathKey}|null} The
   *   absolute path and stat info, the path to redirect to, or `null` if given
   *   invalid input.
   */
  async #resolvePath(dispatch) {
    const path     = dispatch.extra;
    const parts    = [];
    let   endSlash = false;

    for (const p of path.path) {
      if (endSlash) {
        // We got an empty path component _not_ at the end of the path.
        return null;
      }

      switch (p) {
        case '': {
          endSlash = true;
          break;
        }
        case '.': {
          // Nothing to do.
          break;
        }
        case '..': {
          if (parts.length === 0) {
            // Backing up past the base directory.
            return null;
          }
          parts.pop();
          break;
        }
        default: {
          try {
            const decoded = decodeURIComponent(p);
            if (/[/]/.test(decoded)) {
              // Not allowed to have an encoded slash.
              return null;
            }
            parts.push(decoded);
          } catch {
            // Syntax error in encoded path.
            return null;
          }
        }
      }
    }

    const fullPath = `${this.#siteDirectory}/${parts.join('/')}`;
    this.logger?.fullPath(fullPath);

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        if (!endSlash) {
          // Redirect from non-ending-slash directory path.
          parts.push('');
          return { redirect: new TreePathKey(Object.freeze(parts), false) };
        }
      } else if (endSlash) {
        // Non-directory with a slash. Not accepted per class contract.
        return null;
      }
      return { path: fullPath, stats };
    } catch (e) {
      if (e.code === 'ENOENT') {
        this.logger?.notFound(fullPath);
      } else {
        this.logger?.statError(fullPath, e);
      }
      return null;
    }
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
  static #Config = class Config extends ApplicationConfig {
    /**
     * @type {?string} Path to the file to serve for a not-found result, or
     * `null` if not-found handling shouldn't be done.
     */
    #notFoundPath;

    /** @type {string} The base directory for the site files. */
    #siteDirectory;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        notFoundPath = null,
        siteDirectory
      } = config;

      this.#notFoundPath = (notFoundPath === null)
        ? null
        : Files.checkAbsolutePath(notFoundPath);
      this.#siteDirectory = Files.checkAbsolutePath(siteDirectory);
    }

    /** @returns {string} The base directory for the site files. */
    get siteDirectory() {
      return this.#siteDirectory;
    }

    /**
     * @returns {?string} Path to the file to serve for a not-found result, or
     * `null` if not-found handling shouldn't be done.
     */
    get notFoundPath() {
      return this.#notFoundPath;
    }
  };
}
