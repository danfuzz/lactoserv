// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Paths, Statter } from '@this/fs-util';
import { IntfLogger } from '@this/loggy';
import { DispatchInfo, EtagGenerator, Response, HttpUtil, MimeTypes }
  from '@this/net-util';
import { ApplicationConfig } from '@this/sys-config';
import { BaseApplication } from '@this/sys-framework';


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
   * @type {?string} `cache-control` header to automatically include, or
   * `null` not to do that.
   */
  #cacheControl = null;

  /**
   * @type {?EtagGenerator} Etag generator to use, or `null` if not using one.
   */
  #etagGenerator = null;

  /**
   * @type {?Response} Not-found response to issue, or `null` if either not yet
   * calculated or if this instance isn't handling not-found errors.
   */
  #notFoundResponse = null;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    const { cacheControl, etagOptions, notFoundPath, siteDirectory } = config;

    this.#notFoundPath  = notFoundPath;
    this.#siteDirectory = siteDirectory;
    this.#cacheControl  = cacheControl;
    this.#etagGenerator = etagOptions ? new EtagGenerator(etagOptions) : null;
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const resolved = await this.#resolvePath(dispatch);

    if (!resolved) {
      if (this.#notFoundResponse) {
        return request.respond(this.#notFoundResponse);
      } else {
        return false;
      }
    }

    if (resolved.redirect) {
      const redirectTo = resolved.redirect;
      const response   = Response.makeRedirect(redirectTo, 308);

      if (this.#cacheControl) {
        response.cacheControl = this.#cacheControl;
      }

      return await request.respond(response);
    } else if (resolved.path) {
      const contentType =
        MimeTypes.typeFromPathExtension(resolved.path);

      const rawResponse = new Response();

      rawResponse.status = 200;
      rawResponse.headers.set('content-type', contentType);
      await rawResponse.setBodyFile(resolved.path);

      if (this.#cacheControl) {
        rawResponse.cacheControl = this.#cacheControl;
      }

      if (this.#etagGenerator) {
        rawResponse.headers.set('etag',
          await this.#etagGenerator.etagFromFile(resolved.path));
      }

      const { headers, method } = request;
      const response = rawResponse.adjustFor(
        method, headers, { conditional: true, range: true });

      return await request.respond(response);
    } else {
      // Shouldn't happen. If we get here, it's a bug in this class.
      throw new Error('Shouldn\'t happen.');
    }
  }

  /** @override */
  async _impl_start(isReload_unused) {
    const siteDirectory = this.#siteDirectory;

    if (!await Statter.directoryExists(siteDirectory)) {
      throw new Error(`Not found or not a directory: ${siteDirectory}`);
    }

    const notFoundPath = this.#notFoundPath;

    if (notFoundPath) {
      if (!await Statter.fileExists(notFoundPath)) {
        throw new Error(`Not found or not a file: ${notFoundPath}`);
      }

      const response = new Response();

      response.status       = 404;
      response.cacheControl = this.#cacheControl;

      const body        = await fs.readFile(notFoundPath);
      const contentType = MimeTypes.typeFromPathExtension(notFoundPath);

      response.setBodyBuffer(body);
      response.headers.set('content-type', contentType);

      this.#notFoundResponse = response;
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

    // The conditional guarantees that the `fullPath` does not end with a slash,
    // which makes the code below a bit simpler (because we care about only
    // producing canonicalized paths that have no double slashes).
    const fullPath = (parts.length === 0)
      ? this.#siteDirectory
      : `${this.#siteDirectory}/${parts.join('/')}`;
    this.logger?.fullPath(fullPath);

    try {
      const stats = await Statter.statOrNull(fullPath);
      if (stats === null) {
        this.logger?.notFound(fullPath);
        return null;
      } else if (stats.isDirectory()) {
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
          const indexPath = `${fullPath}/index.html`;
          const indexStats = await Statter.statOrNull(indexPath, true);
          if (indexStats === null) {
            this.logger?.indexNotFound(indexPath);
            return null;
          } else if (indexStats.isDirectory()) {
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
      this.logger?.statError(fullPath, e);
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
     * @type {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    #cacheControl = null;

    /**
     * @type {?object} Etag configuration options, or `null` not to generate
     * etags.
     */
    #etagOptions = null;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        cacheControl = null,
        etag         = null,
        notFoundPath = null,
        siteDirectory
      } = config;

      this.#notFoundPath = (notFoundPath === null)
        ? null
        : Paths.checkAbsolutePath(notFoundPath);
      this.#siteDirectory = Paths.checkAbsolutePath(siteDirectory);

      if ((cacheControl !== null) && (cacheControl !== false)) {
        this.#cacheControl = (typeof cacheControl === 'string')
          ? cacheControl
          : HttpUtil.cacheControlHeader(cacheControl);
        if (!this.#cacheControl) {
          throw new Error('Invalid `cacheControl` option.');
        }
      }

      if ((etag !== null) && (etag !== false)) {
        this.#etagOptions =
          EtagGenerator.expandOptions((etag === true) ? {} : etag);
      }
    }

    /**
     * @returns {?string} `cache-control` header to automatically include, or
     * `null` not to do that.
     */
    get cacheControl() {
      return this.#cacheControl;
    }

    /**
     * @returns {?object} Etag configuration options, or `null` not to generate
     * etags.
     */
    get etagOptions() {
      return this.#etagOptions;
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
