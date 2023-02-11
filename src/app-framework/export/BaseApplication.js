// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as timers from 'node:timers';

import { ApplicationConfig } from '@this/app-config';
import { BaseLoggingEnvironment, FormatUtils, IntfLogger } from '@this/loggy';
import { WranglerContext } from '@this/network-protocol';
import { Methods, MustBe } from '@this/typey';

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
    MustBe.instanceOf(config, ApplicationConfig);

    super(config, logger);

    this.#loggingEnv = this.logger?.$env ?? null;
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
   * @param {function(?object=)} next Function which causes the next-bound
   *   middleware to run.
   */
  _impl_handleRequest(req, res, next) {
    Methods.abstract(req, res, next);
  }
}
