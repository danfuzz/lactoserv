// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { PathKey } from '@this/collections';
import { Paths, Statter } from '@this/fs-util';
import { IntfLogger } from '@this/loggy-intf';
import { DispatchInfo, EtagGenerator, FullResponse, HttpUtil, IncomingRequest,
  MimeTypes }
  from '@this/net-util';
import { BaseConfig } from '@this/structy';
import { AskIf } from '@this/typey';


/**
 * Return type from {@link #resolvePath}.
 *
 * @typedef {
 *     { path: string, stats: fs.Stats }
 *   | { redirect: string }
 *   | null
 * } TypeResolved
 */

// TODO: Remove this workaround when this `eslint-plugin-jsdoc` bug is fixed:
// <https://github.com/gajus/eslint-plugin-jsdoc/issues/1347>
const workaroundBug_unused = fs;

/**
 * Class which makes static content responses in a standardized form. This is
 * used by the built-in `StaticFiles` application, and it is provided separately
 * here to help with use cases which want a fairly standard behavior but where
 * not all of the behavior `StaticFiles` is required or appropriate.
 */
export class StaticFileResponder {
  /**
   * Absolute path of the base directory to find files in.
   *
   * @type {string}
   */
  #baseDirectory;

  /**
   * `cache-control` header to automatically include, or `null` not to do that.
   *
   * @type {?string}
   */
  #cacheControl;

  /**
   * Etag generator to use, or `null` if not using one.
   *
   * @type {?EtagGenerator}
   */
  #etagGenerator;

  /**
   * Index file(s) to look for, or `null` to treat directories as not-found.
   *
   * @type {?string[]}
   */
  #indexFile;

  /**
   * Logger to use, if any.
   *
   * @type {?IntfLogger}
   */
  #logger;

  /**
   * Constructs an instance.
   *
   * @param {?object} [config] Instance configuration, or `null` to use all
   *   defaults.
   * @param {string} config.baseDirectory Absolute path of the base directory to
   *   find files in. Required.
   * @param {?object|string} [config.cacheControl] `cache-control` header to
   *   automatically include, or `null` not to include it. Can be passed either
   *   as a literal string or an object to be passed to
   *   {@link HttpUtil#cacheControlHeader}. Default `null`.
   * @param {?object|true} [config.etag] Etag-generating options, `true` for
   *   standard options, or `null` not to include an `etag` header in responses.
   *   Default `null`.
   * @param {?string|string[]} [config.indexFile] Possible index file names, or
   *   `null` to treat directory requests as not-found. Default `null`.
   */
  constructor(config = null) {
    const { baseDirectory, cacheControl, etag, indexFile, logger } =
      new StaticFileResponder.#Config(config);

    this.#baseDirectory = baseDirectory;
    this.#cacheControl  = cacheControl;
    this.#etagGenerator = etag ? new EtagGenerator(etag) : null;
    this.#indexFile     = indexFile;
    this.#logger        = logger;
  }

  /**
   * Performs full request handling, calling through to {@link #resolvePath},
   * and &mdash; if the request could be handled &mdash; then on to
   * {@link #makeResponse}.
   *
   * **Note:** This will only possibly return non-`null` on `GET` and `HEAD`
   * requests.
   *
   * @param {IncomingRequest} request The original request.
   * @param {DispatchInfo} dispatch Dispatch info, indicating the partial path
   *   to serve (in `extra`).
   * @returns {?FullResponse} The response, or `null` if the request could not
   *   be handled.
   */
  async handleRequest(request, dispatch) {
    if (!request.isGetOrHead()) {
      return null;
    }

    const resolved = await this.resolvePath(dispatch);

    return resolved
      ? await this.makeResponse(request, resolved)
      : null;
  }

  /**
   * Makes a response, based on the given request along with a result from
   * {@link #resolvePath}.
   *
   * @param {IncomingRequest} request The original request.
   * @param {TypeResolved} resolved Return value from {@link #resolvePath}.
   * @returns {?FullResponse} The response.
   */
  async makeResponse(request, resolved) {
    if (!resolved) {
      return null;
    } else if (resolved.path) {
      return this.#makeFileResponse(request, resolved);
    } else if (resolved.redirect) {
      return this.#makeRedirectResponse(resolved.redirect);
    } else {
      /* c8 ignore start */
      // Shouldn't happen. If we get here, it's a bug in this class.
      throw new Error('Shouldn\'t happen.');
    }
    /* c8 ignore stop */
  }

  /**
   * Resolves the given dispatch `extra` path to a file, or indicates it should
   * be redirected (if it refers to a directory but `extra` doesn't have the
   * form of a directory request), or indicates that the path is not found.
   *
   * Special cases:
   * * When asked to resolve a path in directory form (trailing slash),
   *   if the path corresponds to a regular (non-directory) file, this method
   *   will treat it as not-found.
   * * Index files (searched for when responding to a directory request) will
   *   only be found if they are in fact regular (non-directory) files.
   *
   * @param {DispatchInfo} dispatch Dispatch info containing the path to
   *   resolve.
   * @returns {TypeResolved} The absolute path and stat info of the file to
   *   serve, the (relative) URL to redirect to, or `null` if given invalid
   *   input or the indicated path is not found.
   */
  async resolvePath(dispatch) {
    const decoded = StaticFileResponder.decodePath(dispatch.extra);

    if (!decoded) {
      return null;
    }

    const { path, isDirectory } = decoded;

    // The conditional guarantees that the `fullPath` does not end with a slash,
    // which makes the code below a bit simpler (because we care about only
    // producing canonicalized paths that have no double slashes).
    const fullPath = (path === '')
      ? this.#baseDirectory
      : `${this.#baseDirectory}/${path}`;
    this.#logger?.fullPath(fullPath);

    try {
      const stats = await Statter.statOrNull(fullPath);
      if (stats === null) {
        this.#logger?.notFound(fullPath);
        return null;
      } else if (stats.isDirectory()) {
        if (!isDirectory) {
          // Redirect from non-ending-slash directory path. As a special case,
          // `path === ''` happens when the mount point (base with regards to
          // `dispatch`) was requested directly, without a final slash. So we
          // need to look at the base to figure out what to redirect to.
          const source = (path === '') ? dispatch.base.path : dispatch.extra.path;
          return { redirect: `${source[source.length - 1]}/` };
        } else {
          // It's a proper directory reference. Look for the index file.
          const indexPath  = `${fullPath}/index.html`;
          const indexStats = await Statter.statOrNull(indexPath, true);
          if (indexStats === null) {
            this.#logger?.indexNotFound(indexPath);
            return null;
          } else if (indexStats.isDirectory()) {
            // Weird case, to be clear!
            this.#logger?.indexIsDirectory(indexPath);
            return null;
          }
          return { path: indexPath, stats: indexStats };
        }
      } else if (isDirectory) {
        // Non-directory file requested as if it is a directory (that is, with a
        // final slash). Treated as not-found per method contract.
        this.#logger?.fileIsDirectory(fullPath);
        return null;
      }
      return { path: fullPath, stats };
    } catch (e) {
      this.#logger?.statError(fullPath, e);
      return null;
    }
  }

  /**
   * Helper for {@link #makeResponse}, which makes a response to serve a file.
   *
   * @param {IncomingRequest} request The original request.
   * @param {TypeResolved} resolved Result from {@link #resolvePath}.
   * @returns {?FullResponse} The response.
   */
  async #makeFileResponse(request, resolved) {
    const { path, stats } = resolved;
    const contentType     = MimeTypes.typeFromPathExtension(path);
    const rawResponse     = new FullResponse();

    rawResponse.status = 200;
    rawResponse.headers.set('content-type', contentType);
    await rawResponse.setBodyFile(path, { stats });

    if (this.#cacheControl) {
      rawResponse.cacheControl = this.#cacheControl;
    }

    if (this.#etagGenerator) {
      rawResponse.headers.set('etag',
        await this.#etagGenerator.etagFromFile(path));
    }

    const { headers, method } = request;
    const response = rawResponse.adjustFor(
      method, headers, { conditional: true, range: true });

    return response;
  }

  /**
   * Helper for {@link #makeResponse}, which makes a redirect response.
   *
   * @param {string} redirect The path to redirect to.
   * @returns {?FullResponse} The response.
   */
  #makeRedirectResponse(redirect) {
    const response = FullResponse.makeRedirect(redirect, 308);

    if (this.#cacheControl) {
      response.cacheControl = this.#cacheControl;
    }

    return response;
  }


  //
  // Static members
  //

  /**
   * Checks / accepts a `baseDirectory` option. This is the absolute path to the
   * base directory for the files to serve.
   *
   * @param {string} value Proposed configuration value.
   * @returns {string} Accepted configuration value.
   */
  static checkBaseDirectory(value) {
    return Paths.checkAbsolutePath(value);
  }

  /**
   * Checks / accepts a `cacheControl` option. This is a `cache-control` header
   * to automatically include, or `null` not to include it. Can be passed either
   * as a literal string or an object to be passed to {@link
   * HttpUtil#cacheControlHeader}.
   *
   * @param {?string|object} value Proposed configuration value.
   * @returns {?string} Accepted configuration value.
   */
  static checkCacheControl(value) {
    if (value === null) {
      return null;
    } else if (typeof value === 'string') {
      return value;
    } else if (AskIf.plainObject(value)) {
      return HttpUtil.cacheControlHeader(value);
    } else {
      throw new Error('Invalid `cacheControl` option.');
    }
  }

  /**
   * Checks / accepts etag-generating options, `true` for default options, or
   * `null` not to include an `etag` header in responses.
   *
   * @param {?object|true} value Proposed configuration value.
   * @returns {?object} Accepted configuration value.
   */
  static checkEtag(value) {
    if (value === null) {
      return null;
    } else if (value === true) {
      return EtagGenerator.expandOptions({});
    } else if (AskIf.plainObject(value)) {
      return EtagGenerator.expandOptions(value);
    } else {
      throw new Error('Invalid `etag` option.');
    }
  }

  /**
   * Checks / accepts index file name options. This is a file name to look for,
   * or a list of file names to look for in order, to use when responding to a
   * request for a directory. If `null` or an empty array, plain directory
   * requests get a not-found response. Names must not contain any slash (`/`)
   * characters.
   *
   * @param {?string|string[]} value Proposed configuration value.
   * @returns {?string[]} Accepted configuration value.
   */
  static checkIndexFile(value) {
    if (value === null) {
      return null;
    } else if (typeof value === 'string') {
      value = [value];
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        return null;
      }
      value = [...value]; // Prevent caller from changing it out from under us.
    } else {
      throw new Error('Invalid `indexFile` option (bad type).');
    }

    if (!AskIf.arrayOfString(value, /(?!.*[/])/)) {
      throw new Error('Invalid `indexFile` option (bad contents).');
    }

    return value;
  }

  /**
   * Decodes a relative path into a simple string along with an "is a directory"
   * flag (which indicates if the final path component was empty). The given
   * path is required to _not_ contain the following path components:
   *
   * * `.`
   * * `..`
   * * an empty path component other than as the final component
   * * any component with a slash (`/`) in it (whether or not escaped)
   * * any component with an invalid escape sequence in it
   *
   * **Note:** This method does _not_ check to see if the resolved path actually
   * exists.
   *
   * @param {PathKey} relativePath The relative path to decode.
   * @returns {?{ isDirectory: boolean, path: string }} The decoded path and
   *   is-a-directory flag, or `null` if it could not be decoded.
   */
  static decodePath(relativePath) {
    const parts       = [];
    let   isDirectory = false; // Is a directory? (Path ends with a slash?)

    for (const p of relativePath.path) {
      if (isDirectory) {
        // We got an empty path component _not_ at the end of the path.
        return null;
      }

      switch (p) {
        case '.':
        case '..': {
          return null;
        }

        case '': {
          isDirectory = true;
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

    const path = (parts.length === 0) ? '' : parts.join('/');
    return { isDirectory, path };
  }

  /** @override */
  static #Config = class Config extends BaseConfig {
    // @defaultConstructor

    /**
     * Absolute path to the base directory for the files to serve.
     *
     * @param {string} value Proposed configuration value.
     * @returns {string} Accepted configuration value.
     */
    _config_baseDirectory(value) {
      return StaticFileResponder.checkBaseDirectory(value);
    }

    /**
     * `cache-control` header to automatically include, or `null` not to
     * include it. Can be passed either as a literal string or an object to be
     * passed to {@link HttpUtil#cacheControlHeader}.
     *
     * @param {?string|object} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?string} Accepted configuration value.
     */
    _config_cacheControl(value = null) {
      return StaticFileResponder.checkCacheControl(value);
    }

    /**
     * Etag-generating options, `true` for default options, or `null` not to
     * include an `etag` header in responses.
     *
     * @param {?object|true} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?object} Accepted configuration value.
     */
    _config_etag(value = null) {
      return StaticFileResponder.checkEtag(value);
    }

    /**
     * A file name to look for, or a list of file names to look for in order, to
     * use when responding to a request for a directory. If `null` or an empty
     * array, plain directory requests get a not-found response. Names must not
     * contain any slash (`/`) characters.
     *
     * @param {?string|string[]} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?string[]} Accepted configuration value.
     */
    _config_indexFile(value = null) {
      return StaticFileResponder.checkIndexFile(value);
    }

    /**
     * Logger to use, if any.
     *
     * @param {?IntfLogger} [value] Proposed configuration value. Default
     *   `null`.
     * @returns {?IntfLogger} Accepted configuration value.
     */
    _config_logger(value = null) {
      return IntfLogger.expectInstanceOrNull(value);
    }
  };
}
