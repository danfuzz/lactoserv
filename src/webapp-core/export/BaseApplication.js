// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { DispatchInfo, FullResponse, IncomingRequest, IntfRequestHandler,
  StatusResponse, TypeOutgoingResponse }
  from '@this/net-util';
import { Methods } from '@this/typey';

import { BaseDispatched } from '#x/BaseDispatched';


/**
 * Base class for the exported (public) application classes.
 *
 * @implements {IntfRequestHandler}
 */
export class BaseApplication extends BaseDispatched {
  // @defaultConstructor

  /** @override */
  async handleRequest(request, dispatch) {
    const logger    = dispatch.logger?.[this.name] ?? this._prot_newDispatchLogger();
    const requestId = logger ? request.id : null;
    const startTime = logger?.$env.now();

    if (logger) {
      dispatch = dispatch.withLogger(logger);
    }

    const logDone = (fate, ...error) => {
      if (logger) {
        const endTime  = logger.$env.now();
        const duration = endTime.subtract(startTime);
        logger[fate](requestId, duration, ...error);
      }
    };

    logger?.handling(requestId, dispatch.infoForLog);

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
}
