// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FullResponse, HttpUtil, StatusResponse, TypeOutgoingResponse }
  from '@this/net-util';
import { MustBe, StringUtil } from '@this/typey';
import { BaseApplication } from '@this/webapp-core';


/**
 * Application that filters requests that match certain commonly-used criteria,
 * resulting in either redirection or some sort of not-found-like response. See
 * docs for configuration object details.
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
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_start() {
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
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      // @defaultConstructor

      /**
       * Set of request methods (e.g. `post`) that the application accepts,
       * lowercased, or `null` if not to filter on request methods. When passed
       * as non-`null`, it is expected to be a single string (if only one method
       * is to be accepted) or an array of strings.
       *
       * @param {?string|Array<string>} value Proposed configuration value.
       *   Default `null`.
       * @returns {?Set<string>} Accepted configuration value.
       */
      _config_acceptMethods(value = null) {
        if (value === null) {
          return null;
        } else {
          const array = StringUtil.checkAndFreezeStrings(value, Config.#METHODS);
          return new Set(array);
        }
      }

      /**
       * The response status to use when filtering out a request.
       *
       * @param {number} [value] Proposed configuration value. Default `404`.
       * @returns {number} Accepted configuration value.
       */
      _config_filterResponseStatus(value = 404) {
        return HttpUtil.checkStatus(value);
      }

      /**
       * Maximum allowed dispatch `extra` path length in slash-separated
       * components (inclusive), or `null` if there is no limit.
       *
       * @param {?number} [value] Proposed configuration value. Default `null`.
       * @returns {?number} Accepted configuration value.
       */
      _config_maxPathDepth(value = null) {
        return (value === null)
          ? null
          : MustBe.number(value, { safeInteger: true, minInclusive: 0 });
      }

      /**
       * Maximum allowed dispatch `extra` path length in octets (inclusive), or
       * `null` if there is no limit.
       *
       * @param {?number} [value] Proposed configuration value. Default `null`.
       * @returns {?number} Accepted configuration value.
       */
      _config_maxPathLength(value = null) {
        return (value === null)
          ? null
          : MustBe.number(value, { safeInteger: true, minInclusive: 0 });
      }

      /**
       * Maximum allowed query (search string) length in octets (inclusive), or
       * `null` if there is no limit.
       *
       * @param {?number} [value] Proposed configuration value. Default `null`.
       * @returns {?number} Accepted configuration value.
       */
      _config_maxQueryLength(value = null) {
        return (value === null)
          ? null
          : MustBe.number(value, { safeInteger: true, minInclusive: 0 });
      }

      /**
       * Redirect file paths to the corresponding directory?
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_redirectDirectories(value = false) {
        return MustBe.boolean(value);
      }

      /**
       * Redirect directory paths to the corresponding file?
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_redirectFiles(value = false) {
        return MustBe.boolean(value);
      }

      /**
       * Reject directory (non-file) paths?
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_rejectDirectories(value = false) {
        return MustBe.boolean(value);
      }

      /**
       * Reject file (non-directory) paths?
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_rejectFiles(value = false) {
        return MustBe.boolean(value);
      }

      /** @override */
      _impl_validate(config) {
        const { redirectDirectories, redirectFiles, rejectDirectories, rejectFiles } = config;
        const boolCount = redirectDirectories + redirectFiles + rejectDirectories + rejectFiles;

        if (boolCount > 1) {
          throw new Error('Cannot configure more than one `redirect*` or `reject*` option as `true`.');
        }

        return config;
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
}
