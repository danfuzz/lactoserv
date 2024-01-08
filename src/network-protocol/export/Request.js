// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ClientRequest, ServerResponse } from 'node:http';

import express from 'express';
import statuses from 'statuses';

import { ManualPromise } from '@this/async';
import { TreePathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy';
import { Uris } from '@this/net-util';
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
   * @type {?boolean} Is the hostname an IP address? Or `null` if not yet
   * determined.
   */
  #hostnameIsIp = null;

  /**
   * @type {?string} Canonicalized hostname string, or `null` if not yet
   * calculated.
   */
  #hostnameStringCanonical = null;

  /** @type {?TreePathKey} Parsed hostname, or `null` if not yet calculated. */
  #parsedHostname = null;

  /**
   * @type {?URL} The parsed version of `.#expressRequest.url`, or `null` if not
   * yet calculated. **Note:** Despite its name, `.url` doesn't contain any of
   * the usual URL bits before the start of the path, so those fields are
   * meaningless here.
   */
  #parsedUrlObject = null;

  /**
   * @type {?TreePathKey} The parsed version of {@link #pathnameString}, or
   * `null` if not yet calculated.
   */
  #parsedPathname = null;

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
   * @returns {TreePathKey} Parsed path key representing the hostname, in most-
   * to least-specific order (that is, back to front). If the original hostname
   * looks like an IP address, this just returns a single-element key with the
   * canonicalized IP address string as the sole element.
   *
   * **Note:** This corresponds to the `subdomains` value defined by
   * `express.Request`.
   */
  get hostname() {
    // This use `subdomains` from `express.Request`, so as to make it easier to
    // ultimately drop Express entirely as a dependency. Also, unlike Express,
    // this canonicalizes IP addresses.
    if (!this.#parsedHostname) {
      const hostname = this.hostnameString;
      let parts;

      if (!hostname) {
        parts = [];
      } else if (this.#hostnameIsIp) {
        parts = [hostname];
      } else {
        parts = hostname.split('.').reverse();
      }

      // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
      this.#parsedHostname = new TreePathKey(Object.freeze(parts), false);
    }

    return this.#parsedHostname;
  }

  /**
   * @returns {?string} The hostname that was passed with the original request,
   * canonicalized if it happened to be an IP address in non-canonical form,
   * or `null` if there was no `Host` header (or similar).
   */
  get hostnameString() {
    if (this.#hostnameIsIp === null) {
      // Note: `expressRequest.hostname` is an Express-specific field. TODO:
      // Replace this usage with our own implementation here, as part of the
      // effort to drop the dependency on Express.

      const hostname    = this.#expressRequest.hostname ?? null;
      const canonicalIp = hostname
        ? Uris.checkIpAddressOrNull(hostname)
        : null;

      if (canonicalIp) {
        this.#hostnameIsIp            = true;
        this.#hostnameStringCanonical = canonicalIp;
      } else {
        this.#hostnameIsIp            = false;
        this.#hostnameStringCanonical = hostname;
      }
    }

    return this.#hostnameStringCanonical;
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
   * @returns {string} The HTTP(ish) request method, downcased, e.g. commonly
   * one of `'get'`, `'head'`, or `'post'`.
   */
  get method() {
    return this.#expressRequest.method.toLowercase();
  }

  /**
   * @returns {TreePathKey} Parsed path key form of {@link #pathnameString}.
   */
  get pathname() {
    if (!this.#parsedPathname) {
      const pathnameString = this.pathnameString;

      if (pathnameString.length <= 1) {
        // Special case: This is an empty path (could be either `''` or `'/'`).
        // If we just let the `else` logic try to handle this, we'd run into
        // trouble because `''.split('/')` // returns `['']` not `[]`.
        this.#parsedPathname = TreePathKey.EMPTY;
      } else {
        // `slice(1)` to avoid having an empty component as the first element.
        const parts = this.pathnameString.slice(1).split('/');

        // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
        this.#parsedPathname = new TreePathKey(Object.freeze(parts), false);
      }
    }

    return this.#parsedPathname;
  }

  /**
   * @returns {string} The path portion of {@link #urlString}, as a string.
   * This starts with a slash (`/`) and omits the search a/k/a query (`?...`),
   * if any. This also includes "resolving" away any `.` or `..` components.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get pathnameString() {
    return this.#parsedUrl.pathname;
  }

  /**
   * @returns {string} The search a/k/a query portion of {@link #urlString},
   * as an unparsed string, or `''` (the empty string) if there is no search
   * string. The result includes anything at or after the first question mark
   * (`?`) in the URL.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get searchString() {
    return this.#parsedUrl.search;
  }

  /**
   * @returns {string} The unparsed URL path that was passed in to the original
   * HTTP(ish) request. Colloquially, this is the suffix of the URL-per-se
   * starting at the first slash (`/`) after the host identifier.
   *
   * For example, for the requested URL
   * `https://example.com:123/foo/bar?baz=10`, this would be `/foo/bar?baz=10`.
   * This field name, though arguably confusing, is as such so as to harmonize
   * with the standard Node field `IncomingRequest.url`. The `url` name with
   * similar semantics is also used by Express.
   */
  get urlString() {
    // Note: Though this framework uses Express under the covers (as of this
    // writing), and Express _does_ rewrite the underlying request's `.url` in
    // some circumstances, the way we use Express should never cause it to do
    // such rewriting. As such, it's appropriate for us to just use `.url`, and
    // not the Express-specific `.originalUrl`. (Ultimately, the hope is to drop
    // use of Express, as it provides little value to this project.)

    const url = this.#expressRequest.url;

    if (!/^[/]/.test(url)) {
      // Sanity check. If this throws, it's a bug and not (in particular) a
      // malformed request (which never should have made it this far).
      throw new Error('Shouldn\'t happen.');
    }

    return url;
  }

  /**
   * Issues a redirect response, with a standard response message and plain text
   * body. The response message depends on the status code.
   *
   * Calling this method results in this request being considered complete, and
   * as such no additional response-related methods will work.
   *
   * **Note:** This method does _not_ do any URL-encoding on the given `target`.
   * It is assumed to be valid and already encoded if necessary. (This is unlike
   * Express which tries to be "smart" about encoding, which can ultimately be
   * more like "confusing.")
   *
   * @param {string} target Possibly-relative target URL.
   * @param {number} [status] Status code.
   * @returns {boolean} `true` when the response is complete.
   */
  redirect(target, status = 302) {
    // Note: This method avoids using `express.Response.redirect()` (a) to avoid
    // ambiguity with the argument `"back"`, and (b) generally with an eye
    // towards dropping Express entirely as a dependency.

    MustBe.string(target);
    MustBe.number(status,
      { safeInteger: true, minInclusive: 100, maxInclusive: 599 });

    const res = this.#expressResponse;
    const message =
      `${status} ${statuses(status)}\n` +
      'Redirecting to:\n' +
      `  ${target}\n`;

    res.status(status);
    res.set('Location', target);
    res.contentType('text/plain');
    res.send(message);

    const resultMp = new ManualPromise();
    res.once('error', (e) => {
      if (!resultMp.isSettled()) {
        resultMp.reject(e);
      }
    });
    res.once('finish', () => {
      if (!resultMp.isSettled()) {
        resultMp.resolve(true);
      }
    });

    return resultMp.promise;
  }

  /**
   * Issues a redirect response targeted at the original request's referrer. If
   * there was no referrer, this redirects to `/`.
   *
   * Calling this method results in this request being considered complete, and
   * as such no additional response-related methods will work.
   *
   * @param {number} [status] Status code.
   * @returns {boolean} `true` when the response is complete.
   */
  redirectBack(status = 302) {
    const target = this.#expressRequest.header('referrer') ?? '/';
    return this.redirect(target, status);
  }

  /**
   * @returns {URL} The parsed version of {@link #urlString}. This is a
   * private getter because the return value is mutable, and we don't want to
   * allow clients to actually mutate it.
   */
  get #parsedUrl() {
    if (!this.#parsedUrlObject) {
      // Note: An earlier version of this code said `new URL(this.urlString,
      // 'x://x')`, so as to make it possible for `urlString` to omit the scheme
      // and host. However, that was totally incorrect, because the _real_
      // requirement is for `urlString` to _always_ be the path. The most
      // notable case where the old code failed was in parsing a path that began
      // with two slashes, which would get incorrectly parsed as having a host.
      this.#parsedUrlObject = new URL(`x://x${this.urlString}`);
    }

    return this.#parsedUrlObject;
  }
}
