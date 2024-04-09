// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseClassedConfig, BaseComponent } from '@this/compote';
import { DispatchInfo, FullResponse, IncomingRequest, IntfRequestHandler,
  StatusResponse, TypeOutgoingResponse }
  from '@this/net-util';
import { Methods, MustBe } from '@this/typey';


/**
 * Base class for the exported (public) application classes.
 *
 * @implements {IntfRequestHandler}
 */
export class BaseApplication extends BaseComponent {
  /**
   * Config instance, if it is an instance of this class's config class, or
   * `null` if not.
   *
   * @type {?BaseApplication.FilterConfig}
   */
  #filterConfig;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { config } = this;
    this.#filterConfig =
      (config instanceof BaseApplication.FilterConfig) ? config : null;
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

    logger?.handling(requestId, dispatch.infoForLog);

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
   * @returns {?TypeOutgoingResponse} Response to the request, if any, as
   *   defined by {@link IntfRequestHandler#handleRequest}.
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
   * @returns {?TypeOutgoingResponse|false} A response indicator (including
   *   `null` to indicate "not handled"), or `false` to indicate that no
   *   filtering was applied.
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
          return FullResponse.makeRedirect(redirect, 308);
        }
      }
    } else if (redirectFiles) {
      if (!dispatch.isDirectory()) {
        return FullResponse.makeRedirect(dispatch.redirectToDirectoryString, 308);
      }
    }

    return false;
  }

  /**
   * Calls {@link #_impl_handleRequest}, and ensures a proper return value.
   *
   * @param {IncomingRequest} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @returns {?TypeOutgoingResponse} Response to the request, if any.
   */
  async #callHandler(request, dispatch) {
    const result = this._impl_handleRequest(request, dispatch);

    const error = (msg) => {
      return new Error(`\`${this.name}._impl_handleRequest()\` ${msg}.`);
    };

    if ((result === null)
        || (result instanceof FullResponse)
        || (result instanceof StatusResponse)) {
      return result;
    } else if (!(result instanceof Promise)) {
      if (result === undefined) {
        throw error('returned `undefined`; probably needs an explicit `return`');
      } else {
        throw error('returned something other than a valid response object, `null`, or a promise');
      }
    }

    const finalResult = await result;

    if ((finalResult === null)
        || (finalResult instanceof FullResponse)
        || (finalResult instanceof StatusResponse)) {
      return finalResult;
    } else if (finalResult === undefined) {
      throw error('async-returned `undefined`; probably needs an explicit `return`');
    } else {
      throw error('async-returned something other than a valid response object or `null`');
    }
  }


  //
  // Static members
  //

  /**
   * @returns {function(new:BaseApplication.Config)} The class {@link #Config}.
   * This class _also_ defines a subclass of it, {@link #FilterConfig}, which
   * can be used for automatic request filtering, but using it is entirely
   * optional.
   *
   * @override
   */
  static _impl_configClass() {
    return BaseApplication.Config;
  }

  /**
   * Default configuration subclass for this (outer) class, which adds no
   * options beyond `class`.
   *
   * This class only really exists to be an easy target to use when subclasses
   * want to define configuration classes in the usual way, without having to
   * remember the persnickety detail of which actual class in the `compote`
   * module is the most appropriate one to derive from.
   */
  static Config = class Config extends BaseClassedConfig {
    // @defaultConstructor
  };

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
  static FilterConfig = class FilterConfig extends BaseApplication.Config {
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
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const {
        acceptMethods       = null,
        maxPathDepth        = null,
        maxPathLength       = null,
        maxQueryLength      = null,
        redirectDirectories = false,
        redirectFiles       = false
      } = rawConfig;

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
