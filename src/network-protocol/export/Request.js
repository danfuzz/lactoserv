// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ClientRequest, ServerResponse } from 'node:http';

import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import express from 'express';


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

  /** @type {ClientRequest|express.Request} HTTP(ish) request object. */
  #expressRequest;

  /** @type {ServerResponse|express.Response} HTTP(ish) response object. */
  #expressResponse;

  /**
   * Constructs an instance.
   *
   * @param {ClientRequest|express.Request} request Request object. This is a
   *   request object as used by Express to a middleware handler (or similar).
   * @param {ServerResponse|express.Response} response Response object. This is
   *   a response object as used by Express to a middleware handler (or
   *   similar).
   * @param {?IntfLogger} logger Logger to use, or `null` to not do any logging.
   */
  constructor(request, response, logger) {
    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    this.#expressRequest  = MustBe.object(request);
    this.#expressResponse = MustBe.object(response);
    this.#logger          = logger;
  }

  /**
   * @returns {ClientRequest|express.Request} The underlying Express(-like)
   * request object.
   */
  get expressRequest() {
    return this.#expressRequest;
  }

  /**
   * @returns {ServerResponse|express.Response} The underlying Express(-like)
   * response object.
   */
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
