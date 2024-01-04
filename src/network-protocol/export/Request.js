// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ClientRequest, ServerResponse } from 'node:http';

import express from 'express';

import { IntfLogger } from '@this/loggy';
import { MustBe } from '@this/typey';

import { RequestLogHelper } from '#p/RequestLogHelper';


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

  /** @type {string} Request ID. */
  #id;

  /** @type {ClientRequest|express.Request} HTTP(ish) request object. */
  #expressRequest;

  /** @type {ServerResponse|express.Response} HTTP(ish) response object. */
  #expressResponse;

  /**
   * @type {?URL} The parsed version of `.#expressRequest.url`, if calculated,
   * or `null` if not yet done. **Note:** Despite its name, `.url` doesn't
   * contain any of the usual URL bits before the start of the path, so those
   * fields are meaningless here.
   */
  #parsedUrlObject = null;

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
   * @returns {?string} The unique-ish request ID, or `null` if there is none
   * (which will happen if there is no associated logger).
   */
  get id() {
    return RequestLogHelper.idFromLogger(this.#logger);
  }

  /**
   * @returns {?IntfLogger} The logger to use with this instance, or `null` not
   * to do any logging.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * @returns {string} The unparsed URL path that was passed in to the original
   * HTTP(ish) request. Colloquially, this is the suffix of the URL-per-se
   * starting at the first slash (`/`) after the host identifier.
   *
   * For example, for the requested URL
   * `https://example.com:123/foo/bar?baz=10`, this would be `/foo/bar?baz=10`.
   */
  get unparsedUrl() {
    // Note: Though this framework uses Express under the covers (as of this
    // writing), and Express _does_ rewrite the underlying request's `.url` in
    // some circumstances, the way we use Express should never cause it to do
    // such rewriting. As such, it's appropriate for us to just use `.url`, and
    // not the Express-specific `.originalUrl`. (Ultimately, the hope is to drop
    // use of Express, as it provides little value to this project.)
    return this.#expressRequest.url;
  }

  /**
   * @returns {string} The path portion of {@link #unparsedUrl}, as a string.
   * This omits the search a/k/a query (`?...`), if any.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get unparsedPathname() {
    return this.#parsedUrl.pathname;
  }

  /**
   * @returns {string} The search a/k/a query portion of {@link #unparsedUrl},
   * as an unparsed string, or `''` (the empty string) if there is no search
   * string. The result includes anything at or after the first question mark
   * (`?`) in the URL.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get unparsedSearch() {
    return this.#parsedUrl.search;
  }

  /**
   * @returns {URL} The parsed version of {@link #unparsedUrl}. This is a
   * private getter because the return value is mutable, and we don't want to
   * allow clients to actually mutate it.
   */
  get #parsedUrl() {
    if (!this.#parsedUrlObject) {
      this.#parsedUrlObject = new URL(this.unparsedUrl, 'x://x');
    }

    return this.#parsedUrlObject;
  }
}
