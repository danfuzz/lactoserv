// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import express from 'express';

import { ApplicationConfig, Files } from '@this/app-config';
import { BaseApplication } from '@this/app-framework';
import { FsUtil } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { MimeTypes } from '@this/net-util';
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

  /** @type {?string} MIME type of the not-found file, if known. */
  #notFoundType = null;

  /** @type {?Buffer} Contents of the not-found file, if known. */
  #notFoundContents = null;

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
    this.#staticMiddleware =
      express.static(siteDirectory, StaticFiles.#SEND_OPTIONS);
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const resolved = await this.#resolvePath(dispatch);

    if (!resolved) {
      if (this.#notFoundType) {
        return request.notFound(this.#notFoundType, this.#notFoundContents);
      } else {
        return false;
      }
    }

    if (resolved.redirect) {
      const redirectTo = resolved.redirect;
      return request.redirect(redirectTo, 301);
    } else if (resolved.path) {
      // TODO: In the short term, use Express's `res.sendFile()`, or use NPM
      // package `send` directly, in the short term. In the long term, do what
      // those things do (in all cases it bottoms out at the `send` package) but
      // even more directly. Notably, it handles all of: content type
      // calculation, HEAD requests, ranges, and etags. For some of those, it
      // will probably be fine to just peel back the onion a bit and use what
      // `send` uses, much of which is more stuff from Express / PillarJS.
      const result =
        await BaseApplication.callMiddleware(request, dispatch, this.#staticMiddleware);

      return result;
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

      this.#notFoundType     = MimeTypes.typeFromExtension(notFoundPath);
      this.#notFoundContents = await fs.readFile(notFoundPath);
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
    maxAge: 5 * 60 * 1000 // 5 minutes.
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
