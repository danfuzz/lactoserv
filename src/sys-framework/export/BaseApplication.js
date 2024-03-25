// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { DispatchInfo, IncomingRequest, IntfRequestHandler, OutgoingResponse }
  from '@this/net-util';
import { ApplicationConfig } from '@this/sys-config';
import { Methods, MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for the exported (public) application classes.
 *
 * @implements {IntfRequestHandler}
 */
export class BaseApplication extends BaseComponent {
  /**
   * @type {?BaseApplication.FilterConfig} Config instance, if it is an instance
   * of this class's config class, or `null` if not.
   */
  #filterConfig;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   */
  constructor(config) {
    super(config);

    this.#filterConfig = (config instanceof BaseApplication.FilterConfig) ? config : null;
  }

  /** @override */
  async handleRequest(request, dispatch) {
    const logger    = this.logger;
    const requestId = logger ? request.id : null;
    const startTime = logger?.$env.now();

    const logDone = (fate, ...error) => {
      if (logger) {
        const endTime  = logger.$env.now();
        const duration = endTime.subtract(startTime);
        logger[fate](requestId, duration, ...error);
      }
    };

    logger?.handling(requestId, dispatch.extraString);

    const filterResult = this.#applyFilters(request, dispatch);

    if (filterResult !== false) {
      logDone(filterResult ? 'filterHandled' : 'filteredOut');
      return filterResult;
    }

    try {
      const result = await this.#callHandler(request, dispatch);
      logDone(result ? 'handled' : 'notHandled');
      return result;
    } catch (e) {
      logDone('threw', e);
      throw e;
    }
  }

  /**
   * Handles a request, as defined by {@link IntfRequestHandler}.
   *
   * @abstract
   * @param {IncomingRequest} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @returns {?OutgoingResponse} Response to the request, if any, as defined by
   *   {@link IntfRequestHandler#handleRequest}.
   */
  async _impl_handleRequest(request, dispatch) {
    Methods.abstract(request, dispatch);
  }

  /**
   * Performs request / dispatch filtering, if the instance is configured to do
   * that. Does nothing (returns `false`) if not.
   *
   * @param {IncomingRequest} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @returns {?OutgoingResponse|false} A response indicator (including `null`
   *   to indicate "not handled"), or `false` to indicate that no filtering was
   *   applied.
   */
  #applyFilters(request, dispatch) {
    const filterConfig = this.#filterConfig;

    if (!filterConfig) {
      return false;
    }

    const {
      acceptMethods, maxPathDepth, maxPathLength, maxQueryLength,
      redirectDirectories, redirectFiles
    } = filterConfig;

    if (acceptMethods && !acceptMethods.has(request.method)) {
      return null;
    }

    if (maxPathDepth !== null) {
      const depth = dispatch.extra.length - (dispatch.isDirectory() ? 1 : 0);
      if (depth > maxPathDepth) {
        return null;
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
        return null;
      }
    }

    if ((maxQueryLength !== null) && (request.searchString.length > maxQueryLength)) {
      return null;
    }

    if (redirectDirectories) {
      if (dispatch.isDirectory()) {
        const redirect = dispatch.redirectToFileString;
        // Don't redirect to `/`, because that would cause a redirect loop.
        if (redirect !== '/') {
          return OutgoingResponse.makeRedirect(redirect, 308);
        }
      }
    } else if (redirectFiles) {
      if (!dispatch.isDirectory()) {
        return OutgoingResponse.makeRedirect(dispatch.redirectToDirectoryString, 308);
      }
    }

    return false;
  }

  /**
   * Calls {@link #_impl_handleRequest}, and ensures a proper return value.
   *
   * @param {IncomingRequest} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @returns {?OutgoingResponse} Response to the request, if any.
   */
  async #callHandler(request, dispatch) {
    const result = this._impl_handleRequest(request, dispatch);

    const error = (msg) => {
      return new Error(`\`${this.name}._impl_handleRequest()\` ${msg}.`);
    };

    if ((result === null) || (result instanceof OutgoingResponse)) {
      return result;
    } else if (!(result instanceof Promise)) {
      if (result === undefined) {
        throw error('returned undefined; probably needs an explicit `return`');
      } else {
        throw error('returned something other than a `OutgoingResponse`, `null`, or a promise');
      }
    }

    const finalResult = await result;

    if ((finalResult === null) || (finalResult instanceof OutgoingResponse)) {
      return finalResult;
    } else if (finalResult === undefined) {
      throw error('async-returned undefined; probably needs an explicit `return`');
    } else {
      throw error('async-returned something other than a `OutgoingResponse` or `null`');
    }
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:ApplicationConfig)} The class {ApplicationConfig}.
   * This class defines a subclass of it, {@link #FilterConfig}, which can be
   * used for automatic request filtering, but using it is entirely optional.
   *
   * @override
   */
  static get CONFIG_CLASS() {
    return ApplicationConfig;
  }

  /**
   * Configuration item subclass for this (outer) class, which accepts URI
   * filtering options.
   *
   * Subclasses of `BaseApplication` can use this directly as their
   * configuration class, _or_ a subclass, _or_ something else entirely. If
   * appropriate, subclasses can "pin" the configured values by modifying the
   * incoming configuration object in the `super()` call in the constructor.
   * Subclasses that do not use this config class will not have this (outer)
   * class's filtering behavior.
   */
  static FilterConfig = class FilterConfig extends ApplicationConfig {
    /**
     * @type {Set<string>} Set of request methods (e.g. `post`) that the
     * application accepts.
     */
    #acceptMethods;

    /**
     * @type {?number} Maximum allowed dispatch `extra` path length in
     * slash-separated components (inclusive), or `null` if there is no limit.
     */
    #maxPathDepth;

    /**
     * @type {?number} Maximum allowed dispatch `extra` path length in octets
     * (inclusive), or `null` if there is no limit.
     */
    #maxPathLength;

    /**
     * @type {?number} Maximum allowed query (search string) length in octets
     * (inclusive), or `null` if there is no limit.
     */
    #maxQueryLength;

    /** @type {boolean} Redirect file paths to the corresponding directory? */
    #redirectDirectories;

    /** @type {boolean} Redirect directory paths to the corresponding file? */
    #redirectFiles;

    /**
     * Constructs an instance.
     *
     * @param {object} config Configuration object.
     */
    constructor(config) {
      super(config);

      const {
        acceptMethods       = null,
        maxPathDepth        = null,
        maxPathLength       = null,
        maxQueryLength      = null,
        redirectDirectories = false,
        redirectFiles       = false
      } = config;

      this.#redirectDirectories = MustBe.boolean(redirectDirectories);
      this.#redirectFiles       = MustBe.boolean(redirectFiles);
      this.#acceptMethods       = (acceptMethods === null)
        ? null
        : new Set(MustBe.arrayOfString(acceptMethods, FilterConfig.#METHODS));
      this.#maxPathDepth = (maxPathDepth === null)
        ? null
        : MustBe.number(maxPathDepth, { safeInteger: true, minInclusive: 0 });
      this.#maxPathLength = (maxPathLength === null)
        ? null
        : MustBe.number(maxPathLength, { safeInteger: true, minInclusive: 0 });
      this.#maxQueryLength = (maxQueryLength === null)
        ? null
        : MustBe.number(maxQueryLength, { safeInteger: true, minInclusive: 0 });

      if (redirectFiles && redirectDirectories) {
        throw new Error('Cannot configure both `redirect*` values as `true`.');
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
     * @type {?number} Maximum allowed dispatch `extra` path length in
     * slash-separated components (inclusive), or `null` if there is no limit.
     */
    get maxPathDepth() {
      return this.#maxPathDepth;
    }

    /**
     * @type {?number} Maximum allowed dispatch `extra` path length in octets
     * (inclusive), or `null` if there is no limit.
     */
    get maxPathLength() {
      return this.#maxPathLength;
    }

    /**
     * @type {?number} Maximum allowed query (search string) length in octets
     * (inclusive), or `null` if there is no limit.
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


    //
    // Static members.
    //

    /** @type {Set<string>} Allowed values for `methods`. */
    static #METHODS = new Set([
      'connect', 'delete', 'get', 'head', 'options',
      'patch', 'post', 'put', 'trace'
    ]);
  };
}
