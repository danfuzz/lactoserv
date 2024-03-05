// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseLoggingEnvironment, IntfLogger } from '@this/loggy';
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
   * @type {?BaseLoggingEnvironment} Logging environment, or `null` the instance
   * is not doing logging.
   */
  #loggingEnv;

  /**
   * Constructs an instance.
   *
   * @param {ApplicationConfig} config Configuration for this application.
   * @param {?IntfLogger} logger Logger to use at the application layer
   *   (incoming requests have their own logger), or `null` to not do any
   *   logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#filterConfig = (config instanceof BaseApplication.FilterConfig) ? config : null;
    this.#loggingEnv   = this.logger?.$env ?? null;
  }

  /** @override */
  async handleRequest(request, dispatch) {
    const filterConfig = this.#filterConfig;

    if (filterConfig) {
      const {
        acceptQueries, acceptMethods,
        maxPathLength, redirectDirectories, redirectFiles
      } = filterConfig;

      if (!acceptQueries && (request.searchString !== '')) {
        return null;
      }

      if (acceptMethods && !acceptMethods.has(request.method)) {
        return null;
      }

      if (maxPathLength !== null) {
        const length = dispatch.extra.length - (dispatch.isDirectory() ? 1 : 0);
        if (length > maxPathLength) {
          return null;
        }
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
    }

    const result = this.#callHandler(request, dispatch);

    return this.logger
      ? this.#logHandlerCall(request, dispatch, result)
      : result;
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

  /**
   * Logs a call to the handler, ultimately returning or throwing whatever the
   * given result settles to.
   *
   * @param {IncomingRequest} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @param {Promise<?OutgoingResponse>} result Promise for the handler
   *   response.
   * @returns {?OutgoingResponse} Response to the request, if any.
   */
  async #logHandlerCall(request, dispatch, result) {
    const startTime = this.#loggingEnv.now();
    const logger    = this.logger;
    const id        = request.id;

    logger?.handling(id, dispatch.extraString);

    const done = (fate, ...error) => {
      const endTime  = this.#loggingEnv.now();
      const duration = endTime.subtract(startTime);
      logger[fate](id, duration, ...error);
    };

    try {
      const finalResult = await result;
      done(finalResult ? 'handled' : 'notHandled');
      return finalResult;
    } catch (e) {
      done('threw', e);
      throw e;
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
    /** @type {boolean} Does the application accept query parameters? */
    #acceptQueries;

    /**
     * @type {Set<string>} Set of request methods (e.g. `post`) that the
     * application accepts.
     */
    #acceptMethods;

    /**
     * @type {?number} Maximum allowed dispatch `extra` path length, inclusive
     * (in components), or `null` if there is no limit.
     */
    #maxPathLength;

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
        acceptQueries       = true,
        acceptMethods       = null,
        maxPathLength       = null,
        redirectDirectories = false,
        redirectFiles       = false
      } = config;

      this.#redirectDirectories = MustBe.boolean(redirectDirectories);
      this.#redirectFiles       = MustBe.boolean(redirectFiles);
      this.#acceptQueries       = MustBe.boolean(acceptQueries);
      this.#acceptMethods       = (acceptMethods === null)
        ? null
        : new Set(MustBe.arrayOfString(acceptMethods, FilterConfig.#METHODS));
      this.#maxPathLength = (maxPathLength === null)
        ? null
        : MustBe.number(maxPathLength, { safeInteger: true, minInclusive: 0 });

      if (redirectFiles && redirectDirectories) {
        throw new Error('Cannot configure both `redirect*` values as `true`.');
      }
    }

    /** @returns {boolean} Does the application accept query parameters? */
    get acceptQueries() {
      return this.#acceptQueries;
    }

    /**
     * @returns {Set<string>} Set of request methods (e.g. `post`) that the
     * application accepts.
     */
    get acceptMethods() {
      return this.#acceptMethods;
    }

    /**
     * @returns {?number} Maximum allowed dispatch `extra` path length,
     * inclusive (in components), or `null` if there is no limit. The limit, if
     * any, does not include the empty component at the end of a directory path.
     */
    get maxPathLength() {
      return this.#maxPathLength;
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
