// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ClientRequest, ServerResponse } from 'node:http';

import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';


/**
 * Representation of an in-progress HTTP(ish) request, including both request
 * data _and_ ways to send a response.
 *
 * Ultimately, this class wraps both the request and response objects that are
 * provided by Express, though it is intended to offer a simpler (less crufty)
 * and friendlier interface to them. That said and as of this writing, it is
 * possible to reach in and grab the underlying objects; the hope is that, over
 * time, this will be less and less necessary, and eventually the wrapped
 * objects will be able to be fully hidden from the interface presented by this
 * class.
 */
export class Request {
  /**
   * @type {?IntfLogger} Logger to use for this instance, or `null` if the
   * instance is not doing logging.
   */
  #logger;

  /**
   * @type {object} HTTP(ish) request object. This is a request object as passed
   * by Express to a middleware handler.
   */
  #expressRequest;

  /**
   * @type {object} HTTP(ish) response object. This is a response object as
   * passed by Express to a middleware handler.
   */
  #expressResponse;

  /**
   * Constructs an instance.
   *
   * @param {ClientRequest} request Express request object.
   * @param {ServerResponse} response Express response object.
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(request, response, logger) {
    this.#expressRequest  = MustBe.instanceOf(ClientRequest, request);
    this.#expressResponse = MustBe.instanceOf(ServerResponse, response);
    this.#logger          = logger;
  }

  /** @returns {ClientRequest} The underlying Express request object. */
  get expressRequest() {
    return this.#expressRequest;
  }

  /** @returns {ServerResponse} The underlying Express response object. */
  get expressResponse() {
    return this.#expressResponse;
  }

  /**
   * @returns {?IntfLogger} The logger to use with this instance, or `null` not
   * to do any logging.
   */
  get logger() {
    return this.#logger;
  }
}
