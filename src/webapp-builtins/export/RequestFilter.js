// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse, HttpUtil, StatusResponse, TypeOutgoingResponse }
  from '@this/net-util';
import { MustBe } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that filters requests that match certain commonly-used criteria,
 * resulting in either redirection or some sort of not-found-like response.
 * See docs for configuration object details.
 *
 * **Note:** This class is meant to handle a decent handful of commonly-used
 * cases, but it is _not_ intended to be a "kitchen sink" of filtering. It is
 * always possible to write one's own custom request filtering class, should the
 * options on this one turn out to be insufficient for a particular use case.
 */
export class RequestFilter extends BaseApplication {
  // @defaultConstructor

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const {
      acceptMethods, maxPathDepth, maxPathLength, maxQueryLength,
      redirectDirectories, redirectFiles, rejectDirectories, rejectFiles
    } = this.config;

    if (redirectDirectories || redirectFiles || rejectDirectories || rejectFiles) {
      if (dispatch.isDirectory()) {
        if (rejectDirectories) {
          return this.#filteredOut();
        } else if (redirectDirectories) {
          const redirect = dispatch.redirectToFileString;
          // Don't redirect to `/`, because that would cause a redirect loop.
          if (redirect !== '/') {
            return FullResponse.makeRedirect(redirect, 308);
          }
        }
      } else {
        if (rejectFiles) {
          return this.#filteredOut();
        } else if (redirectFiles) {
          return FullResponse.makeRedirect(dispatch.redirectToDirectoryString, 308);
        }
      }
    }

    if (acceptMethods && !acceptMethods.has(request.method)) {
      return this.#filteredOut();
    }

    if (maxPathDepth !== null) {
      const depth = dispatch.extra.length - (dispatch.isDirectory() ? 1 : 0);
      if (depth > maxPathDepth) {
        return this.#filteredOut();
      }
    }

    if (maxPathLength !== null) {
      // Note: We calculate this based on how the `extra` would get converted
      // back to a path string if it were the entire `pathname` of the URL. This
      // is arguably the most sensible tactic, in that if this instance actually
      // is the one that was immediately dispatched to from an endpoint, `extra`
      // will in fact be the same as `pathname`.
      const extra  = dispatch.extra;
      const length =
        extra.length +    // One octet per slash if it were `pathname`.
        extra.charLength; // Total count of characters in all components.
      if (length > maxPathLength) {
        return this.#filteredOut();
      }
    }

    if ((maxQueryLength !== null) && (request.searchString.length > maxQueryLength)) {
      return this.#filteredOut();
    }

    // No filter criteria applied to this request.
    return null;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }

  /**
   * Returns the appropriate handler response for a request which has been
   * filtered out.
   *
   * @returns {TypeOutgoingResponse} The response.
   */
  #filteredOut() {
    return StatusResponse.fromStatus(this.config.filterResponseStatus);
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
     * The response status to use when filtering out a request.
     *
     * @type {number}
     */
    #filterResponseStatus;

    /**
     * Set of request methods (e.g. `post`) that the application accepts.
     *
     * @type {Set<string>}
     */
    #acceptMethods;

    /**
     * Maximum allowed dispatch `extra` path length in slash-separated
     * components (inclusive), or `null` if there is no limit.
     *
     * @type {?number}
     */
    #maxPathDepth;

    /**
     * Maximum allowed dispatch `extra` path length in octets (inclusive), or
     * `null` if there is no limit.
     *
     * @type {?number}
     */
    #maxPathLength;

    /**
     * Maximum allowed query (search string) length in octets (inclusive), or
     * `null` if there is no limit.
     *
     * @type {?number}
     */
    #maxQueryLength;

    /**
     * Redirect file paths to the corresponding directory?
     *
     * @type {boolean}
     */
    #redirectDirectories;

    /**
     * Redirect directory paths to the corresponding file?
     *
     * @type {boolean}
     */
    #redirectFiles;

    /**
     * Reject directory (non-file) paths?
     *
     * @type {boolean}
     */
    #rejectDirectories;

    /**
     * Reject file (non-directory) paths?
     *
     * @type {boolean}
     */
    #rejectFiles;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        acceptMethods        = null,
        filterResponseStatus = 404,
        maxPathDepth         = null,
        maxPathLength        = null,
        maxQueryLength       = null,
        redirectDirectories  = false,
        redirectFiles        = false,
        rejectDirectories    = false,
        rejectFiles          = false
      } = rawConfig;

      this.#acceptMethods = (acceptMethods === null)
        ? null
        : new Set(MustBe.arrayOfString(acceptMethods, Config.#METHODS));
      this.#filterResponseStatus = HttpUtil.checkStatus(filterResponseStatus);
      this.#maxPathDepth = (maxPathDepth === null)
        ? null
        : MustBe.number(maxPathDepth, { safeInteger: true, minInclusive: 0 });
      this.#maxPathLength = (maxPathLength === null)
        ? null
        : MustBe.number(maxPathLength, { safeInteger: true, minInclusive: 0 });
      this.#maxQueryLength = (maxQueryLength === null)
        ? null
        : MustBe.number(maxQueryLength, { safeInteger: true, minInclusive: 0 });
      this.#redirectDirectories = MustBe.boolean(redirectDirectories);
      this.#redirectFiles       = MustBe.boolean(redirectFiles);
      this.#rejectDirectories   = MustBe.boolean(rejectDirectories);
      this.#rejectFiles         = MustBe.boolean(rejectFiles);

      const boolCount =
        redirectDirectories + redirectFiles + rejectDirectories + rejectFiles;
      if (boolCount > 1) {
        throw new Error('Cannot configure more than one `redirect*` or `reject*` option as `true`.');
      }
    }

    /**
     * @returns {Set<string>} Set of request methods (e.g. `post`) that the
     * application accepts.
     */
    get acceptMethods() {
      return this.#acceptMethods;
    }

    /**
     * @returns {number} The response status to use when filtering out a
     * request.
     */
    get filterResponseStatus() {
      return this.#filterResponseStatus;
    }

    /**
     * Maximum allowed dispatch `extra` path length in slash-separated
     * components (inclusive), or `null` if there is no limit.
     *
     * @type {?number}
     */
    get maxPathDepth() {
      return this.#maxPathDepth;
    }

    /**
     * Maximum allowed dispatch `extra` path length in octets (inclusive), or
     * `null` if there is no limit.
     *
     * @type {?number}
     */
    get maxPathLength() {
      return this.#maxPathLength;
    }

    /**
     * Maximum allowed query (search string) length in octets (inclusive), or
     * `null` if there is no limit.
     *
     * @type {?number}
     */
    get maxQueryLength() {
      return this.#maxQueryLength;
    }

    /**
     * @returns {boolean} Redirect file paths to the corresponding directory?
     */
    get redirectDirectories() {
      return this.#redirectDirectories;
    }

    /**
     * @returns {boolean} Redirect directory paths to the corresponding file?
     */
    get redirectFiles() {
      return this.#redirectFiles;
    }

    /** @returns {boolean} Reject directory (non-file) paths? */
    get rejectDirectories() {
      return this.#rejectDirectories;
    }

    /** @returns {boolean} Reject file (non-directory) paths? */
    get rejectFiles() {
      return this.#rejectFiles;
    }


    //
    // Static members.
    //

    /**
     * Allowed values for `methods`.
     *
     * @type {Set<string>}
     */
    static #METHODS = new Set([
      'connect', 'delete', 'get', 'head', 'options',
      'patch', 'post', 'put', 'trace'
    ]);
  };
}
