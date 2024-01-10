// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ManualPromise } from '@this/async';

import { DispatchInfo } from '#x/DispatchInfo';
import { IntfRequestHandler } from '#x/IntfRequestHandler';
import { Request } from '#x/Request';


/**
 * Utilities for working with Express middleware. This class is meant to work
 * correctly, though it is not particularly aimed at efficiency.
 */
export class ExpressLegacy {
  /**
   * Calls through to a regular Express-style middleware function, converting
   * its `next()` usage to the `async` style used by this system. Because
   * Express doesn't offer a straightforward way to tell when a request has
   * definitely been handled, this method uses a couple different tactics to try
   * to suss it out, but it _might_ end up being flaky in some cases. (No actual
   * flakiness has been observed as of this writing, but it's definitely
   * something to watch out for).
   *
   * This method is meant as a helper when wrapping Express middleware in a
   * concrete instance of this class.
   *
   * @param {Request} request Request object.
   * @param {DispatchInfo} dispatch Dispatch information.
   * @param {function(object, object, function(?string|object))} middleware
   *   Express-style middleware function.
   * @returns {boolean} Was the request handled? This is the result request
   *   handling as defined by {@link IntfRequestHandler#handleRequest}.
   */
  static async callMiddleware(request, dispatch, middleware) {
    const { expressRequest: req, expressResponse: res } = request;
    const resultMp = new ManualPromise();
    const origEnd  = res.end;

    // "Spy" on `res.end`, so we can async-return when appropriate.
    res.end = (...args) => {
      res.end = origEnd;
      res.end(...args);

      req.baseUrl = baseUrl;
      req.url     = url;

      if (!resultMp.isSettled()) {
        resultMp.resolve(true);
      }
    };

    // Hook up a `next()` which cleans up the "spy" on `res` and causes this
    // method to return.
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

    // Modify the request, to insert the dispatch information (this system
    // normally doesn't mess with incoming request objects), but Express
    // middleware _does_ expect dispatch-related bits to be set), and then
    // restore it on the way back out.
    const { baseUrl, url } = req;

    req.baseUrl = dispatch.baseString;
    req.url     = dispatch.extraString;

    try {
      middleware(req, res, next);
    } catch (e) {
      resultMp.reject(e);
    }

    await resultMp.promise;

    // Only return when the response actually gets completed from the
    // perspective of the original `request`.
    return request.whenResponseDone();
  }
}
