// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Paths, Statter } from '@this/fs-util';
import { FullResponse, HttpUtil, MimeTypes, StatusResponse }
  from '@this/net-util';
import { BaseApplication } from '@this/webapp-core';
import { StaticFileResponder } from '@this/webapp-util';


/**
 * Static content server. See docs for configuration object details as well as
 * information about the class's behavior in general.
 */
export class StaticFiles extends BaseApplication {
  /**
   * "Responder" that does most of the actual work of this class.
   *
   * @type {StaticFileResponder}
   */
  #responder;

  /**
   * Path to the file to serve for a not-found result, or `null` if not-found
   * handling shouldn't be done.
   *
   * @type {?string}
   */
  #notFoundPath;

  /**
   * Absolute path to the base directory of files to serve.
   *
   * @type {string}
   */
  #siteDirectory;

  /**
   * `cache-control` header to automatically include, or `null` not to do that.
   *
   * @type {?string}
   */
  #cacheControl = null;

  /**
   * Not-found response to issue, or `null` if either not yet calculated or if
   * this instance isn't handling not-found errors.
   *
   * @type {?FullResponse}
   */
  #notFoundResponse = null;

  /**
   * Modification time of the file {@link #notFoundPath} at the time it was last
   * read to create {@link #notFoundResponse} as a msec-since-Epoch time, or
   * `null` if not yet read.
   *
   * @type {?number}
   */
  #notFoundModTime = null;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { cacheControl, etag, notFoundPath, siteDirectory } = this.config;

    this.#cacheControl  = cacheControl;
    this.#notFoundPath  = notFoundPath;
    this.#siteDirectory = siteDirectory;
    this.#responder     = new StaticFileResponder({
      baseDirectory: siteDirectory,
      cacheControl,
      etag,
      indexFile: 'index.html'
    });
  }

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const response =
      await this.#responder.handleRequest(request, dispatch);

    if (response) {
      return response;
    } if (!request.isGetOrHead()) {
      return StatusResponse.FORBIDDEN;
    } else {
      return this.#notFound();
    }
  }

  /** @override */
  async _impl_start() {
    const siteDirectory = this.#siteDirectory;

    if (!await Statter.directoryExists(siteDirectory)) {
      throw new Error(`Not found or not a directory: ${siteDirectory}`);
    }

    const notFoundPath = this.#notFoundPath;

    if (notFoundPath) {
      // This does initial setup of `notFoundResponse`, and will throw if it
      // can't be loaded. This is meant to help catch the salient config problem
      // during startup instead of just as the first _actual_ not-found response
      // is needed.
      await this.#notFound();
    }

    await super._impl_start();
  }

  /**
   * Updates (if necessary) and returns {@link #notFoundResponse}. This returns
   * `null` if this instance isn't set up to directly handle not-found cases.
   *
   * @returns {?FullResponse} The response for a not-found situation.
   */
  async #notFound() {
    const notFoundPath = this.#notFoundPath;

    if (!notFoundPath) {
      return null;
    }

    const existingResponse = this.#notFoundResponse;
    const stats            = await Statter.statOrNull(notFoundPath);
    const isFile           = stats?.isFile();

    if (existingResponse) {
      if (!isFile) {
        // This means that, when the system started, the `notFoundPath` was
        // successfully loaded, but now it's having trouble getting refreshed.
        // We log the problem and return the old value.
        this.logger?.notFoundPathDisappeared(notFoundPath);
        return existingResponse;
      } else if (stats.mtimeMs === this.#notFoundModTime) {
        // The pre-existing response is still fresh.
        return existingResponse;
      }
    } else if (!isFile) {
      // We end up here during startup, if the `notFoundPath` isn't possibly a
      // readable file.
      throw new Error(`Not found or not a file: ${notFoundPath}`);
    }

    // Either `#notFoundResponse` has never been set up, or it's in need of an
    // update.

    const response = new FullResponse();

    response.status       = 404;
    response.cacheControl = this.#cacheControl;

    const body        = await fs.readFile(notFoundPath);
    const contentType = MimeTypes.typeFromPathExtension(notFoundPath);

    response.setBodyBuffer(body);
    response.headers.set('content-type', contentType);

    this.#notFoundResponse = response;
    this.#notFoundModTime  = stats.mtimeMs;

    return response;
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.configClass {
      // @defaultConstructor

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
       * Absolute path to the file to serve for a not-found result, or `null` if
       * not-found handling shouldn't be done.
       *
       * @param {?string} [value] Proposed configuration value. Default `null`.
       * @returns {?string} Accepted configuration value.
       */
      _config_notFoundPath(value = null) {
        return (value === null)
          ? null
          : Paths.checkAbsolutePath(value);
      }

      /**
       * Absolute path to the base directory for the site files.
       *
       * @param {string} value Proposed configuration value.
       * @returns {string} Accepted configuration value.
       */
      _config_siteDirectory(value) {
        return StaticFileResponder.checkBaseDirectory(value);
      }
    };
  }
}
