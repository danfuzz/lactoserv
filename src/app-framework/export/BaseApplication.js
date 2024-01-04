// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ApplicationConfig } from '@this/app-config';
import { ManualPromise } from '@this/async';
import { BaseLoggingEnvironment, IntfLogger } from '@this/loggy';
import { IntfRequestHandler, Request } from '@this/network-protocol';
import { Methods } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for the exported (public) application classes.
 *
 * @implements {IntfRequestHandler}
 */
export class BaseApplication extends BaseComponent {
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

    this.#loggingEnv = this.logger?.$env ?? null;
  }

  /** @override */
  async handleRequest(request) {
    let startTime;
    let id;

    if (this.logger) {
      startTime = this.#loggingEnv.now();
      id        = request.id;
      this.logger.handling(id, request.unparsedUrl);
    }

    const result = this._impl_handleRequest(request);

    if (this.logger) {
      // Arrange to log about the result of the `_impl_` call once it settles.
      (async () => {
        let eventType;
        let error = [];

        try {
          const settled = await result;
          eventType = settled ? 'handled' : 'notHandled';
        } catch (e) {
          error = [e];
          eventType = 'threw';
        }

        const endTime  = this.#loggingEnv.now();
        const duration = endTime.subtract(startTime);
        this.logger[eventType](id, duration, ...error);
      })();
    }

    return result;
  }

  /**
   * Handles a request, as defined by {@link IntfRequestHandler}.
   *
   * @abstract
   * @param {Request} request Request object.
   * @returns {boolean} Was the request handled? Flag as defined by the method
   *   {@link IntfRequestHandler#handleRequest}.
   */
  async _impl_handleRequest(request) {
    Methods.abstract(request);
  }


  //
  // Static members
  //

  /** @override */
  static get CONFIG_CLASS() {
    return ApplicationConfig;
  }

  /**
   * Calls through to a regular Express-style middleware function, converting
   * its `next()` usage to the `async` style used by this system.
   *
   * This method is meant as a helper when wrapping Express middleware in a
   * concrete instance of this class.
   *
   * @param {Request} request Request object.
   * @param {function(object, object, function(?string|object))} middleware
   *   Express-style middleware function.
   * @returns {boolean} Was the request handled? This is the result request
   *   handling as defined by {@link IntfRequestHandler#handleRequest}.
   */
  static async callMiddleware(request, middleware) {
    const { expressRequest: req, expressResponse: res } = request;
    const resultMp = new ManualPromise();
    const origEnd  = res.end;

    const next = (arg = null) => {
      res.end = origEnd;
      if ((arg === null) || (arg === 'route')) {
        resultMp.resolve(false);
      } else if (arg instanceof Error) {
        resultMp.reject(arg);
      } else {
        resultMp.reject(new Error(`Strange value passed to \`next()\`: ${arg}`));
      }
    };

    res.end = (...args) => {
      res.end = origEnd;
      res.end(...args);
      resultMp.resolve(true);
    };

    try {
      middleware(req, res, next);
    } catch (e) {
      resultMp.reject(e);
    }

    return resultMp.promise;
  }

  /**
   * Sets up a regular Express-style response object (that is wrapped by the
   * given {@link Request}), such that a call to `end()` on it will in turn
   * cause this method to async-return.
   *
   * This method is meant as a helper when wrapping Express middleware in a
   * concrete instance of this class.
   *
   * @param {Request} request Request object.
   * @returns {boolean} `true`, after `end()` was called.
   */
  static async whenEnded(request) {
    const res = request.expressResponse;

    if (res.writableEnded) {
      // Already ended!
      return true;
    }

    const origEnd  = res.end;
    const resultMp = new ManualPromise();

    res.end = (...args) => {
      res.end = origEnd;
      res.end(...args);
      resultMp.resolve(true);
    };

    return resultMp.promise;
  }
}
