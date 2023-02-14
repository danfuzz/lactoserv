// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers';

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
  async handleRequestAsync(req, res) {
    let startTime;
    let id;

    if (this.logger) {
      startTime = this.#loggingEnv.nowSec();
      id        = WranglerContext.get(req)?.id;
      this.logger.handling(id, req.url);
    }

    const result = this._impl_handleRequestAsync(req, res);

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
   * Handles a request, as defined by the Express middleware spec and the
   * public method on this class {@link #handleRequestAsync}.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   */
  async _impl_handleRequestAsync(req, res) {
    // TODO: This should be an abstract method. What's here right now is
    // scaffolding to convert from async back to callback-style handling.
    this.logger?.SCAFFOLDING_BACK_TO_CALLBACK();

    return BaseApplication.callMiddleware(req, res,
      (...args) => this._impl_handleRequest(...args));
  }

  /**
   * Asks this instance's underlying application to handle the given request.
   * Parameters are as defined by the Express middleware spec.
   *
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(?*)} next Function which causes the next-bound middleware
   *   to run.
   */
  handleRequest(req, res, next) {
    // What's going on here: The most straightforward way -- maybe the only
    // reasonable way -- to time the action of an Express-style handler is to
    // notice calls to either the `next` function passed into it or to `end()`
    // getting called on the response. Whichever happens first signals the end
    // of the action. Note that a `prefinish` event is _supposed_ to get emitted
    // when `res.end()` is called, but in practice that does not happen with
    // HTTP2. So instead, we replace `res.end()` with an instrumented version
    // that calls through to the original.

    const startTime = this.#loggingEnv?.nowSec();
    const id        = WranglerContext.get(req)?.id;

    this.logger?.handling(id, req.url);

    let resEnded   = false;
    let nextCalled = false;
    const origEnd  = res.end;

    const done = () => {
      if (resEnded || nextCalled) {
        // This will probably end up as an uncaught exception, which is about as
        // reasonable as can be expected.
        this.logger?.doubleCompletion(id, { nextCalled, resEnded });
        throw new Error('Double completion');
      }

      if (this.logger) {
        const endTime  = this.#loggingEnv.nowSec();
        const duration = endTime - startTime;
        this.logger.handled(id, FormatUtils.durationStringFromSecs(duration));
      }

      res.end = origEnd;
    };

    const innerNext = (...args) => {
      done();
      this.logger?.next(id, args);
      timers.setImmediate(next, ...args);
      nextCalled = true;
    };

    res.end = (...args) => {
      origEnd.call(res, ...args);
      done();
      this.logger.done(id);
      resEnded = true;
    };

    this._impl_handleRequest(req, res, innerNext);
  }

  /**
   * Handles a request, as defined by the Express middleware spec.
   *
   * @abstract
   * @param {object} req Request object.
   * @param {object} res Response object.
   * @param {function(?object)} next Function which causes the next-bound
   *   middleware to run.
   */
  _impl_handleRequest(req, res, next) {
    Methods.abstract(req, res, next);
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
   *   #handleRequestAsync}
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
