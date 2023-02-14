// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ApplicationConfig } from '@this/app-config';
import { ManualPromise } from '@this/async';
import { BaseLoggingEnvironment, FormatUtils, IntfLogger } from '@this/loggy';
import { WranglerContext } from '@this/network-protocol';
import { Methods } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for the exported (public) application classes.
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
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(config, logger) {
    super(config, logger);

    this.#loggingEnv = this.logger?.$env ?? null;
  }

  /**
   * Asks this instance's underlying application to handle the given request.
   * Parameters are as defined by the Express middleware spec, except that
   * instead of a `next` callback argument, this method async-returns to
   * indicate the status of the request. Specifically:
   *
   * * Returning `true` means that the request was fully handled. (In regular
   *   Express, this is achieved by not-calling `next()` at all.)
   * * Returning `false` means that the request was not handled at all. (In
   *   regular Express, this is achieved by calling `next()` or `next('route')`,
   *   that is, with no argument or the single argument `'route'`.)
   * * Throwing an error means that the request failed fatally. (In regular
   *   Express, this is achieved by calling `next(error)`, that is, passing it
   *   an `Error` object.)
   *
   * **Note:** Express differentiates between `next()` and `next('route')`, but
   * the nature of this system is that there is no distinction, because there
   * are no sub-chained routes. To achieve that effect, a concrete subclass of
   * this class would instead perform its own internal route chaining.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @returns {boolean} Was the request handled? Flag as described above.
   */
  async handleRequest(req, res) {
    let startTime;
    let id;

    if (this.logger) {
      startTime = this.#loggingEnv.nowSec();
      id        = WranglerContext.get(req)?.id;
      this.logger.handling(id, req.url);
    }

    const result = this._impl_handleRequest(req, res);

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

        const endTime  = this.#loggingEnv.nowSec();
        const duration = endTime - startTime;
        const durStr   = FormatUtils.durationStringFromSecs(duration);
        this.logger[eventType](id, durStr, ...error);
      })();
    }

    return result;
  }

  /**
   * Handles a request, as defined by the Express middleware spec and this
   * class's method {@link #handleRequest}.
   *
   * @abstract
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @returns {boolean} Was the request handled? Flag as defined by {@link
   *   #handleRequest}
   */
  async _impl_handleRequest(req, res) {
    Methods.abstract(req, res);
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
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(object, object, function(?string|object))} middleware
   *   Express-style middleware function.
   * @returns {boolean} Was the request handled? Flag as defined by {@link
   *   #handleRequest}
   */
  static async callMiddleware(req, res, middleware) {
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
}
