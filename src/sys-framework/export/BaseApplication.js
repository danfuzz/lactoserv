// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseLoggingEnvironment, IntfLogger } from '@this/loggy';
import { DispatchInfo, IntfRequestHandler, IncomingRequest, OutgoingResponse }
  from '@this/net-util';
import { ApplicationConfig } from '@this/sys-config';
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
  async handleRequest(request, dispatch) {
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

  /** @override */
  static get CONFIG_CLASS() {
    return ApplicationConfig;
  }
}
