// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { FsUtil } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { MimeTypes } from '@this/net-util';
import { DispatchInfo } from '@this/network-protocol';


/**
 * Static content server. See docs for configuration object details as well as
 * information about the class's behavior in general.
 */
export class StaticFiles extends BaseApplication {
  /**
   * @type {?string} Path to the file to serve for a not-found result, or
   * `null` if not-found handling shouldn't be done.
   */
  #notFoundPath;

  /** @type {string} Absolute path to the base directory of files to serve. */
  #siteDirectory;

  /**
   * @type {?object} Options to use when issuing a not-found response, or `null`
   * if not yet calculated (including if not handling not-found errors).
   */
  #notFoundOptions = null;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    const { notFoundPath, siteDirectory } = config;

    this.#notFoundPath  = notFoundPath;
    this.#siteDirectory = siteDirectory;
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const resolved = await this.#resolvePath(dispatch);

    if (!resolved) {
      if (this.#notFoundOptions) {
        return request.sendNotFound(this.#notFoundOptions);
      } else {
        return false;
      }
    }

    if (resolved.redirect) {
      const redirectTo = resolved.redirect;
      return request.sendRedirect(redirectTo, { status: 301 });
    } else if (resolved.path) {
      return await request.sendFile(resolved.path, StaticFiles.#SEND_OPTIONS);
    } else {
      // Shouldn't happen. If we get here, it's a bug in this class.
      throw new Error('Shouldn\'t happen.');
    }
  }

  /** @override */
  async _impl_start(isReload_unused) {
    const siteDirectory = this.#siteDirectory;

    if (!await FsUtil.directoryExists(siteDirectory)) {
      throw new Error(`Not found or not a directory: ${siteDirectory}`);
    }

    const notFoundPath = this.#notFoundPath;

    if (notFoundPath) {
      if (!await FsUtil.fileExists(notFoundPath)) {
        throw new Error(`Not found or not a file: ${notFoundPath}`);
      }

      this.#notFoundOptions = {
        ...(StaticFiles.#SEND_OPTIONS),
        body:        await fs.readFile(notFoundPath),
        contentType: MimeTypes.typeFromExtension(notFoundPath)
      };
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
   * @returns {{path: string, stats: fs.Stats}|{redirect: string}|null} The
   *   absolute path and stat info of the file to serve, the (absolute or
   *   relative) URL to redirect to, or `null` if given invalid input or the
   *   indicated path is not found.
   */
  async #resolvePath(dispatch) {
    const path     = dispatch.extra.path;
    const parts    = [];
    let   endSlash = false; // Path ends with a slash?

    for (const p of path) {
      if (endSlash) {
        // We got an empty path component _not_ at the end of the path.
        return null;
      }

      switch (p) {
        case '.':
        case '..': {
          // These should have already been resolved away. This is a thrown
          // error (and not `return null`) because it is indicative of a bug in
          // this project.
          throw new Error('Shouldn\'t happen.');
        }
        case '': {
          endSlash = true;
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
          // Redirect from non-ending-slash directory path. As a special case,
          // `parts.length === 0` happens when the mount point was requested
          // directly, without a final slash. So we need to look at the base
          // to figure out what to redirect to.
          const source = (parts.length === 0)
            ? dispatch.base.path
            : parts;
          return { redirect: `${source[source.length - 1]}/` };
        } else {
          // It's a proper directory reference. Look for the index file.
          const indexPath  = `${fullPath}/index.html`;
          const indexStats = await fs.stat(indexPath);
          if (indexStats.isDirectory()) {
            // Weird case, to be clear!
            this.logger?.indexIsDirectory(indexPath);
            return null;
          }
          return { path: indexPath, stats: indexStats };
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

  /** @type {object} File sending/serving configuration options. */
  static #SEND_OPTIONS = Object.freeze({
    maxAgeMsec: 5 * 60 * 1000 // 5 minutes.
  });

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
