// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import { ClientRequest, ServerResponse } from 'node:http';

import express from 'express';
import statuses from 'statuses';

import { ManualPromise } from '@this/async';
import { TreePathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy';
import { MimeTypes } from '@this/net-util';
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

    if (!/^[/]/.test(request.url)) {
      // Sanity check. If this throws, it's a bug and not (in particular) a
      // malformed request (which never should have made it this far).
      throw new Error('Shouldn\'t happen.');
    }
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
   * **Note:** If the original incoming pathname was just `'/'` (e.g., it was
   * from an HTTP request of literally `GET /`), then the value here is a
   * single-element key with empty value, that is `['']`, and _not_ an empty
   * key. This preserves the invariant that the keys for all directory-like
   * requests end with an empty path element.
   */
  get pathname() {
    if (!this.#parsedPathname) {
      // `slice(1)` to avoid having an empty component as the first element.
      const pathStr = this.pathnameString;
      const parts   = pathStr.slice(1).split('/');

      // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
      this.#parsedPathname = new TreePathKey(Object.freeze(parts), false);
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
    return this.#expressRequest.url;
  }

  /**
   * Issues a "not found" (status `404`) response, with optional body. If no
   * body is provided, a simple default plain-text body is used. The response
   * includes the single content/cache-related header `Cache-Control: no-store,
   * must-revalidate`. If the request method is `HEAD`, this will _not_ send the
   * body as part of the response.
   *
   * @param {string} [contentType] Content type for the body. Must be valid if
   *  `body` is passed as non-`null`.
   * @param {string|Buffer} [body] Body content.
   * @returns {boolean} `true` when the response is completed.
   */
  async notFound(contentType = null, body = null) {
    const sendOpts = body
      ? { contentType, body }
      : { bodyExtra: `  ${this.urlString}\n` };

    return this.#sendNonContentResponse(404, sendOpts);
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
   * @returns {boolean} `true` when the response is completed.
   */
  async redirect(target, status = 302) {
    // Note: This method avoids using `express.Response.redirect()` (a) to avoid
    // ambiguity with the argument `"back"`, and (b) generally with an eye
    // towards dropping Express entirely as a dependency.

    MustBe.string(target);

    return this.#sendNonContentResponse(status, {
      bodyExtra: `  ${target}\n`,
      headers:   { 'Location': target }
    });
  }

  /**
   * Issues a redirect response targeted at the original request's referrer. If
   * there was no referrer, this redirects to `/`.
   *
   * Calling this method results in this request being considered complete, and
   * as such no additional response-related methods will work.
   *
   * @param {number} [status] Status code.
   * @returns {boolean} `true` when the response is completed.
   */
  async redirectBack(status = 302) {
    const target = this.#expressRequest.header('referrer') ?? '/';
    return this.redirect(target, status);
  }

  /**
   * Issues a successful response, with the given body contents or with an empty
   * body as appropriate. The actual reported status will be one of:
   *
   * * `200` -- A `body` was passed (even if empty), and there were no
   *   conditional request parameters (e.g., `if-none-match`) which indicate
   *   that the body shouldn't be sent. The body is sent in this case, unless
   *   the request method was `HEAD`.
   * * `204` -- No `body` was passed. (And no body is sent in response.)
   * * `206` -- A body is being returned, and a range request matches.
   * * `304` -- There was at least one conditional request parameter which
   *   matched. No body is sent.
   * * `416` -- A range request couldn't be satisfied. The original body isn't
   *   sent, but an error message body _is_ sent.
   *
   * In all cases where a `body` is passed (even if empty), this always reponds
   * with the headers `Accept-Ranges`, `Cache-Control`, and `ETag`.
   *
   * @param {object} options Options to control response behavior.
   * @param {string|Buffer|null} [options.body] Complete body to send, if any.
   * @param {?string} [options.contentType] Content type for the body. Required
   *   if `options.body` is passed.
   * @param {?object} [options.headers] Extra headers to include in the
   *   response, if any.
   * @param {?number} [options.maxAgeMsec] Value to send back in the
   *   `max-age` property of the `Cache-Control` response header. Defaults to
   *   `0`.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  async sendContent(options = {}) {
    const { body, contentType, headers, maxAgeMsec = 0 } = options ?? {};
    const res = this.#expressResponse;

    if (body) {
      if (!contentType) {
        throw new Error('Missing `contentType`.');
      } else if (!(body instanceof Buffer)) {
        MustBe.string(body);
      }

      res.contentType(MimeTypes.typeFromExtensionOrType(contentType));
    }

    if (headers) {
      res.set(headers);
    }

    if (body) {
      res.set('Accept-Ranges', 'bytes');
      res.set('Cache-Control', `public, max-age=${Math.floor(maxAgeMsec / 1000)}`);
      res.set('ETag', '"TODO-etag-goes-here"');
      res.status(200);
      res.send(body);
    } else {
      res.status(204);
      res.end();
    }

    return this.whenResponseDone();
  }

  /**
   * Issues a successful response, with the contents of the given file or with
   * an empty body as appropriate. The actual reported status will vary, with
   * the same possibilities as with {@link #sendContent}.
   *
   * This method throws an error if the given `path` does not correspond to a
   * readable non-directory file. That is, this method is not in the business of
   * handling directory redirection, higher level not-found reporting, etc. That
   * sort of stuff should be handled _before_ calling this method.
   *
   * @param {string} path Absolute path to the file to send.
   * @param {object} options Options to control response behavior.
   * @param {?object} [options.headers] Extra headers to include in the
   *   response, if any.
   * @param {?number} [options.maxAgeMsec] Value to send back in the
   *   `max-age` property of the `Cache-Control` response header. Defaults to
   *   `0`.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  async sendFile(path, options = {}) {
    MustBe.string(path, /^[/]/);
    MustBe.object(options);

    const { headers = null, maxAgeMsec = 0 } = options;

    if (headers) {
      MustBe.object(headers);
    }

    MustBe.number(maxAgeMsec, { minInclusive: 0, safeInteger: true });

    const stats = await fs.stat(path);
    if (stats.isDirectory()) {
      throw new Error(`Cannot send directory: ${path}`);
    }

    const res          = this.#expressResponse;
    const finalHeaders = headers ? { ...headers } : {};

    // Set up `Content-Type` if the caller didn't specify it explicitly.
    finalHeaders['Content-Type'] ??= MimeTypes.typeFromExtension(path);

    // In re `dotfiles`: If the caller wants to send a dotfile, that's their
    // business. (`sendFile()` by default tries to be something like a
    // "friendly" static file server, but we're lower level here.)
    const sendOpts = {
      dotfiles: 'allow',
      headers:  finalHeaders,
      maxAge:   maxAgeMsec
    };

    // TODO: Stop using Express's `response.sendFile()`, as part of the
    // long-term aim to stop using Express at all. In the short term, switch
    // to the `send` package (which is what Express bottoms out at here). In the
    // long term, do what `send` does, but even more directly (among other
    // reasons, so we can use our style of logging in it and so we don't have to
    // translate between callback and promise call styles). Things that we'll
    // have to deal with include _at least_: HEAD requests, conditional
    // requests, ranges, etags, and maybe more. For some of those, it will
    // probably be fine to just use the same packages `send` does, much of which
    // is more stuff from Express / PillarJS.

    const doneMp = new ManualPromise();
    res.sendFile(path, sendOpts, (err) => {
      if (err instanceof Error) {
        doneMp.reject(err);
      } else if (err) {
        doneMp.reject(new Error(`Non-Error error: ${err}`));
      } else {
        doneMp.resolve(true);
      }
    });

    // Wait for `sendFile()` to claim to be done, and handle errors that can
    // reasonably be reported back as HTTP(ish) responses.
    try {
      await doneMp.promise;
    } catch (e) {
      // Only attempt to report this via an HTTP(ish) response if the error
      // comes with the tell-tale properties that indicate that it should in
      // fact be reported this way. (We do this check as such instead of doing
      // `e instanceof http-errors.HttpError` because the latter could end up
      // spuriously failing if we end up with a build that has multiple
      // competing versions of the `http-error` package due to NPM version
      // "fun.")
      if (e.expose && typeof e.status === 'number') {
        return this.#sendNonContentResponse(e.status, {
          bodyExtra: e.message,
          headers:   e.headers ?? {}
        });
      }
      throw e;
    }

    // ...but don't return to _our_ caller until the response is actually
    // completed (which could be slightly later), and also plumb through any
    // errors that were encountered during final response processing.
    return this.whenResponseDone();
  }

  /**
   * Returns when the underlying response has been closed successfully or has
   * errored. Returns `true` for a normal close, or throws whatever error the
   * response reports.
   *
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by the underlying response object.
   */
  async whenResponseDone() {
    const res = this.#expressResponse;

    function makeProperError(error) {
      return (error instanceof Error)
        ? error
        : new Error(`non-error object: ${error}`);
    }

    if (res.closed || res.destroyed || res.writableEnded) {
      const error = res.errored;
      if (error) {
        throw makeProperError(error);
      }
      return true;
    }

    const resultMp = new ManualPromise();

    res.once('error', (error) => {
      if (error) {
        resultMp.reject(makeProperError(error));
      } else {
        resultMp.resolve(true);
      }
    });

    res.once('close', () => {
      if (!resultMp.isSettled()) {
        resultMp.resolve(true);
      }
    });

    return resultMp.promise;
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
      const urlObj = new URL(`x://x${this.urlString}`);

      if (urlObj.pathname === '') {
        // Shouldn't normally happen, but tolerate an empty pathname, converting
        // it to `/`. (`new URL()` will return an instance like this if there's
        // no slash after the hostname.)
        urlObj.pathname = '/';
      }

      this.#parsedUrlObject = urlObj;
    }

    return this.#parsedUrlObject;
  }

  /**
   * Sends a response of the given status, with various options for the response
   * headers and body. The response headers always get set to make the response
   * _not_ be cacheable. This method is intended to be used for all "meta-ish"
   * non-content responses, such as not-founds, redirects, etc., so as to
   * provide a standard form of response (though with some flexibility).
   *
   * @param {number} status The status code.
   * @param {?object} [options] Options for the response.
   * @param {string|Buffer|null} [options.body] Complete body to send, if any.
   *   If not supplied, one is constructed based on the `status` and
   *   `options.bodyExtra`.
   * @param {?string} [options.bodyExtra] Text to append to a constructed body.
   *   Only used if `options.body` is not passed.
   * @param {?string} [options.contentType] Content type for the body. Required
   *   if `options.body` is passed.
   * @param {?object} [options.headers] Extra response headers to send, if any.
   * @returns {boolean} `true` when the response is completed.
   */
  #sendNonContentResponse(status, options = null) {
    MustBe.number(status, { safeInteger: true, minInclusive: 0, maxInclusive: 599 });
    const { body, bodyExtra, contentType, headers } = options ?? {};

    let finalBody;
    let finalContentType;

    if (body) {
      if (!contentType) {
        throw new Error('Missing `contentType`.');
      }
      finalBody        = body;
      finalContentType = MimeTypes.typeFromExtensionOrType(contentType);
    } else {
      const statusStr  = statuses(status);
      const bodyHeader = `${status} ${statusStr}`;

      if (((bodyExtra ?? '') === '') || (bodyExtra === statusStr)) {
        finalBody = `${bodyHeader}\n`;
      } else {
        const finalNl = (bodyExtra.endsWith('\n')) ? '' : '\n';
        finalBody = `${bodyHeader}:\n${bodyExtra}${finalNl}`;
      }

      finalContentType = 'text/plain';
    }

    const res = this.#expressResponse;

    res.status(status);
    res.contentType(finalContentType);

    if (headers) {
      res.set(headers);
    }

    res.set('Cache-Control', 'no-store, must-revalidate');
    res.send(finalBody);

    return this.whenResponseDone();
  }
}
