// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs/promises';
import { ClientRequest, ServerResponse } from 'node:http';
import * as http2 from 'node:http2';

import etag from 'etag';
import express from 'express';
import fresh from 'fresh';
import rangeParser from 'range-parser';
import statuses from 'statuses';

import { ManualPromise } from '@this/async';
import { TreePathKey } from '@this/collections';
import { FormatUtils, IntfLogger } from '@this/loggy';
import { Cookies, HostInfo, HttpHeaders, HttpUtil, MimeTypes }
  from '@this/net-util';
import { AskIf, MustBe } from '@this/typey';

import { WranglerContext } from '#x/WranglerContext';


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
 *
 * **Note:** This class does not implement any understanding of reverse proxy
 * headers. It is up to constructors of this class to pass appropriate
 * constructor parameters to get this class to do the right thing when running
 * behind a reverse proxy. That said, as of this writing there isn't anything
 * that actually does that. See
 * <https://github.com/danfuzz/lactoserv/issues/213>.
 *
 * #### `options` on `send*()` methods
 *
 * The `send*()` methods accept an `options` object argument, which accepts the
 * following properties, which all affect only _successful_ responses (not ones
 * reporting an error status).
 *
 * * `{?Cookies} cookies` -- Cookies to include (via `Set-Cookie` headers) in
 *   the response, if any.
 * * `{?object} headers` -- Extra headers to include in the response, if any.
 *   If specified, this can be any of the types accepted by the standard
 *   `Headers` constructor. Note that this system defines a useful `Headers`
 *   subclass, {@link HttpHeaders}.
 * * `{?number} maxAgeMsec` -- Value to send back in the `max-age` property of
 *   the `Cache-Control` response header. Defaults to `0`.
 */
export class Request {
  /**
   * @type {?IntfLogger} Logger to use for this instance, or `null` if the
   * instance is not doing logging.
   */
  #logger = null;

  /**
   * @type {?string} Request ID, or `null` if the instance is not doing logging.
   */
  #id = null;

  /**
   * @type {WranglerContext} Most-specific outer context responsible for this
   * instance. (This instance might also get directly associated with a context,
   * but it doesn't get to find out about it.)
   */
  #outerContext;

  /** @type {ClientRequest|express.Request} HTTP(ish) request object. */
  #expressRequest;

  /** @type {ServerResponse|express.Response} HTTP(ish) response object. */
  #expressResponse;

  /** @type {string} The protocol name. */
  #protocolName;

  /** @type {string} The request method, downcased. */
  #requestMethod;

  /**
   * @type {HostInfo} The host header(ish) info, or `null` if not yet figured
   * out.
   */
  #host = null;

  /** @type {?Cookies} The parsed cookies, or `null` if not yet figured out. */
  #cookies = null;

  /**
   * @type {?URL} The parsed version of {@link #targetString}, or `null` if not
   * yet calculated. **Note:** Despite it being an instance of `URL`, the
   * `target` doesn't ever contain the parts of a URL before the path, so those
   * fields are meaningless here.
   */
  #parsedTargetObject = null;

  /**
   * Constructs an instance.
   *
   * @param {WranglerContext} context Most-specific context that was responsible
   *   for constructing this instance.
   * @param {ClientRequest|express.Request} request Request object. This is a
   *   request object as used by Express to a middleware handler (or similar).
   * @param {ServerResponse|express.Response} response Response object. This is
   *   a response object as used by Express to a middleware handler (or
   *   similar).
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   */
  constructor(context, request, response, logger) {
    this.#outerContext = MustBe.instanceOf(context, WranglerContext);

    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    this.#expressRequest  = MustBe.object(request);
    this.#expressResponse = MustBe.object(response);
    this.#requestMethod   = request.method.toLowerCase();
    this.#protocolName    = `http-${request.httpVersion}`;

    if (logger) {
      this.#id     = logger.$meta.makeId();
      this.#logger = logger[this.#id];
    }
  }

  /**
   * @returns {Cookies} Cookies that have been parsed from the request, if any.
   * This is an empty instance if there were no cookies (or at least no
   * syntactically correct cookies). Whether or not empty, the instance is
   * always frozen.
   */
  get cookies() {
    if (!this.#cookies) {
      const cookieStr = this.getHeaderOrNull('cookie');
      const result    = cookieStr ? Cookies.parse(cookieStr) : null;

      this.#cookies = result ? Object.freeze(result) : Cookies.EMPTY;
    }

    return this.#cookies;
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
   * @returns {object} Map of all incoming headers to their values, as defined
   * by Node's `IncomingMessage.headers`.
   */
  get headers() {
    // TODO: This should be a `HttpHeaders` object.
    return this.#expressRequest.headers;
  }

  /**
   * @returns {HostInfo} Info about the `Host` header (or equivalent). If there
   * is no header (etc.), it is treated as if it were specified as just
   * `localhost`.
   */
  get host() {
    if (!this.#host) {
      const req = this.#expressRequest;

      // Note: `authority` is used by HTTP2.
      const { authority } = req;
      const localPort     = this.#outerContext.wrangler.interface.port;

      if (authority) {
        this.#host = HostInfo.safeParseHostHeader(authority, localPort);
      } else {
        const host = this.getHeaderOrNull('host');
        this.#host = host
          ? HostInfo.safeParseHostHeader(host, localPort)
          : HostInfo.localhostInstance(localPort);
      }
    }

    return this.#host;
  }

  /**
   * @returns {?string} The unique-ish request ID, or `null` if there is none
   * (which will happen if there is no associated logger).
   */
  get id() {
    return this.#id;
  }

  /**
   * @returns {?IntfLogger} The logger to use with this instance, or `null` if
   * the instance is not doing any logging.
   */
  get logger() {
    return this.#logger;
  }

  /**
   * @returns {string} The HTTP(ish) request method, downcased, e.g. commonly
   * one of `'get'`, `'head'`, or `'post'`.
   */
  get method() {
    return this.#requestMethod;
  }

  /**
   * @returns {?{ address: string, port: number }} The IP address and port of
   * the origin (remote side) of the request, if known. `null` if not known.
   */
  get origin() {
    const {
      remoteAddress: address,
      remotePort: port
    } = this.#outerContext.socket ?? {};

    return address ? { address, port } : null;
  }

  /**
   * @returns {?TreePathKey} Parsed path key form of {@link #pathnameString}, or
   * `null` if this instance doesn't represent a usual `origin` request.
   *
   * **Note:** If the original incoming pathname was just `'/'` (e.g., it was
   * from an HTTP request of literally `GET /`), then the value here is a
   * single-element key with empty value, that is `['']`, and _not_ an empty
   * key. This preserves the invariant that the keys for all directory-like
   * requests end with an empty path element.
   */
  get pathname() {
    return this.#parsedTarget.pathname ?? null;
  }

  /**
   * @returns {?string} The path portion of {@link #targetString}, as a string,
   * or `null` if this instance doesn't represent a usual `origin` request (that
   * is, the kind that includes a path). This starts with a slash (`/`) and
   * omits the search a/k/a query (`?...`), if any. This also includes
   * "resolving" away any `.` or `..` components.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get pathnameString() {
    return this.#parsedTarget.pathnameString ?? null;
  }

  /**
   * @returns {string} The name of the protocol which this instance is using.
   * This is generally a string starting with `http-` and ending with the
   * dotted version. This corresponds to the (unencrypted) protocol being used
   * over the (possibly encrypted) transport, and has nothing to do _per se_
   * with the port number which the remote side of this request connected to in
   * order to send the request.
   */
  get protocolName() {
    // Note: Express defines `.protocol` with fairly different semantics, as
    // being either `http` or `https`, which is really more about the
    // _transport_ than the protocol.
    return this.#protocolName;
  }

  /**
   * @returns {string} The search a/k/a query portion of {@link #targetString},
   * as an unparsed string, or `''` (the empty string) if there is no search
   * string. The result includes anything at or after the first question mark
   * (`?`) in the URL.
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
   */
  get searchString() {
    return this.#parsedTarget.searchString;
  }

  /**
   * @returns {string} The unparsed target that was passed in to the original
   * HTTP(ish) request. In the common case of the target being a path to a
   * resource, colloquially speaking, this is the suffix of the URL-per-se
   * starting at the first slash (`/`) after the host identifier. That said,
   * there are other non-path forms for a target. See
   * <https://www.rfc-editor.org/rfc/rfc7230#section-5.3> for the excruciating
   * details.
   *
   * For example, for the requested URL
   * `https://example.com:123/foo/bar?baz=10`, this would be `/foo/bar?baz=10`.
   * This property name corresponds to the standard Node field
   * `IncomingRequest.url`, even though it's not actually a URL per se. We chose
   * to diverge from Node for the sake of clarity.
   */
  get targetString() {
    return this.#parsedTarget.targetString;
  }

  /**
   * @returns {string} A reasonably-suggestive but possibly incomplete
   * representation of the incoming request, in the form of a protocol-less URL.
   * This is meant for logging, and specifically _not_ for any routing or other
   * more meaningful computation (hence the name).
   */
  get urlForLogging() {
    const { host }               = this;
    const { targetString, type } = this.#parsedTarget;
    const prefix                 = `//${host.namePortString}`;

    return (type === 'origin')
      ? `${prefix}${targetString}`
      : `${prefix}:${type}=${targetString}`;
  }

  /**
   * Gets a request header, by name.
   *
   * @param {string} name The header name.
   * @returns {?string|Array<string>} The corresponding value, or `null` if
   *   there was no such header.
   */
  getHeaderOrNull(name) {
    return this.#expressRequest.headers[name] ?? null;
  }

  /**
   * Gets all reasonably-logged info about the request that was made.
   *
   * **Note:** The `headers` in the result omits anything that is redundant
   * with respect to other parts of the return value. (E.g., the `cookie` header
   * is omitted if it was able to be parsed.)
   *
   * @returns {object} Loggable information about the request.
   */
  getLoggableRequestInfo() {
    const {
      cookies,
      headers,
      method,
      origin,
      urlForLogging
    } = this;

    const originString = origin
      ? FormatUtils.addressPortString(origin.address, origin.port)
      : '<unknown>';

    const result = {
      origin:   originString,
      protocol: this.protocolName,
      method,
      url:      urlForLogging,
      headers:  Request.#sanitizeRequestHeaders(headers),
    };

    if (cookies.size !== 0) {
      result.cookies = Object.fromEntries(cookies);
      delete result.headers.cookie;
    }

    return result;
  }

  /**
   * Gets all reasonably-logged info about the response that was made. This
   * method async-returns after the response has been completed, either
   * successfully or with an error. In case of an error, this method aims to
   * report the error-ish info via a normal return (not by `throw`ing).
   *
   * **Note:** The `headers` in the result omits anything that is redundant
   * with respect to other parts of the return value. (E.g., the
   * `content-length` header is always omitted, and the `:status` pseudo-header
   * is omitted from HTTP2 response headers.)
   *
   * @returns {object} Loggable information about the response.
   */
  async getLoggableResponseInfo() {
    let requestError = null;

    try {
      await this.whenResponseDone();
    } catch (e) {
      requestError = e;
    }

    const connectionError = this.#outerContext.socket.errored ?? null;
    const res             = this.#expressResponse;
    const statusCode      = res.statusCode;
    const headers         = res.getHeaders();
    const contentLength   = headers['content-length'] ?? 0;

    const result = {
      ok: !(requestError || connectionError),
      contentLength,
      statusCode,
      headers: Request.#sanitizeResponseHeaders(headers),
    };

    const fullErrors = [];
    let   errorStr   = null;

    if (requestError) {
      const code = Request.#extractErrorCode(requestError);

      fullErrors.push(requestError);
      result.requestError = code;
      errorStr = code;
    }

    if (connectionError) {
      const code = Request.#extractErrorCode(connectionError);

      fullErrors.push(connectionError);
      result.connectionError = code;
      errorStr = errorStr ? `${errorStr},${code}` : code;
    }

    if (fullErrors.length !== 0) {
      result.errors     = errorStr;
      result.fullErrors = fullErrors;
    }

    return result;
  }

  /**
   * Checks to see if a response with the given headers would be considered
   * "fresh" such that a not-modified (status `304`) response could be issued.
   *
   * A request is considered fresh if all of the following are true:
   * * The request method is `HEAD` or `GET`.
   * * The request doesn't ask for caching to be off.
   * * The request has at least one condition which checks for freshness, and
   *   all such conditions pass.
   *
   * This assumes that the response would have a sans-check status code that is
   * acceptable for conversion to the not-modified status (`304`).
   *
   * **Note:** This is akin to Express's `request.fresh` getter.
   *
   * @param {HttpHeaders} responseHeaders Would-be response headers that could
   *   possibly affect the freshness calculation.
   * @returns {boolean} `true` iff the request is to be considered "fresh."
   */
  isFreshWithRespectTo(responseHeaders) {
    const method = this.#requestMethod;

    if ((method !== 'head') && (method !== 'get')) {
      return false;
    }

    return fresh(this.headers, responseHeaders.extract('etag', 'last-modified'));
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
   * * `206` -- A body is being returned, and a range request matches which can
   *   be satisfied with a single range result. (Multiple disjoint range matches
   *   are treated like non-range requests.)
   * * `304` -- There was at least one conditional request parameter which
   *   matched. No body is sent.
   * * `416` -- A range request couldn't be satisfied. The original body isn't
   *   sent, but an error message body _is_ sent.
   *
   * If the request method was `HEAD`, this does _not_ send the `body`, but it
   * still calculates the length and etag.
   *
   * In all successful cases, this method always responds with a `Cache-Control`
   * header.
   *
   * In all successful cases where a `body` is passed (even if empty), this
   * always reponds with the headers `Accept-Ranges` and `ETag`.
   *
   * This method honors range requests, and will reject ones that cannot be
   * satisfied.
   *
   * @param {string|Buffer|null} body Complete body to send, with `null`
   *   indicating a zero-length response (which, to be clear is different than
   *   not sending a body at all). If passed as a `string`, it is encoded as
   *   UTF-8, and the content type of the response will list that as the
   *   charset.
   * @param {string} contentType Content type for the body. If this value starts
   *   with `text/` and/or the `body` is passed as a string, then the actual
   *   `Content-Type` header will indicate a charset of `utf-8`.
   * @param {object} options Options to control response behavior. See class
   *   header comment for more details.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  async sendContent(body, contentType, options = {}) {
    let bodyBuffer;
    let stringBody = false;

    if (body === null) {
      // This is an unusual case, and it's not worth doing anything particularly
      // special for it (e.g. pre-allocating a zero-length buffer).
      bodyBuffer = Buffer.alloc(0);
    } else if (AskIf.string(body)) {
      bodyBuffer = Buffer.from(body, 'utf8');
      stringBody = true;
    } else if (body instanceof Buffer) {
      bodyBuffer = body;
    } else {
      throw new Error('`body` must be a string, a `Buffer`, or `null`.');
    }

    MustBe.string(contentType);
    contentType = MimeTypes.typeFromExtensionOrType(contentType);

    // Start with the headers that will be used for any non-error response. All
    // such responses are cacheable, per spec.
    const headers = this.#makeResponseHeaders('cacheable', options, {
      'etag': () => {
        return etag(bodyBuffer);
      }
    });

    if (this.isFreshWithRespectTo(headers)) {
      // For basic range-support headers.
      headers.appendAll(this.#rangeInfo().headers);
      return this.#writeCompleteResponse(304, headers);
    }

    // At this point, we need to make a "non-fresh" response (that is, send
    // content, assuming no header parsing issues).

    headers.appendAll({
      'content-length': bodyBuffer.length,
      'content-type': (stringBody || /^text[/]/.test(contentType))
        ? `${contentType}; charset=utf-8`
        : contentType
    });

    const rangeInfo = this.#rangeInfo(bodyBuffer.length, headers);
    if (rangeInfo.error) {
      // Note: We _don't_ use the for-success `headers` here.
      return this.#sendNonContentResponseWithMessageBody(
        rangeInfo.status, { headers: rangeInfo.headers });
    } else {
      headers.appendAll(rangeInfo.headers);
      bodyBuffer = bodyBuffer.subarray(rangeInfo.start, rangeInfo.end);
      headers.set('content-length', bodyBuffer.length);
    }

    const bodyToSend = (this.method === 'head') ? null : bodyBuffer;
    return this.#writeCompleteResponse(rangeInfo.status, headers, bodyToSend);
  }

  /**
   * Issues an error (status `4xx` or `5xx`) response, with optional body. If no
   * body is provided, a simple default plain-text body is used. The response
   * includes a `Cache-Control` header if the status code is (per spec)
   * cacheable. If the request method is `HEAD`, this will _not_ send a body
   * as part of the response.
   *
   * @param {number} statusCode The status code.
   * @param {?string} [contentType] Content type for the body. Must be valid if
   *  `body` is passed as non-`null`.
   * @param {?string|Buffer} [body] Body content.
   * @returns {boolean} `true` when the response is completed.
   */
  async sendError(statusCode, contentType = null, body = null) {
    MustBe.number(statusCode, { safeInteger: true, minInclusive: 400, maxInclusive: 599 });
    const sendOpts = body
      ? { contentType, body }
      : { bodyExtra: `  ${this.targetString}\n` };

    return this.#sendNonContentResponseWithMessageBody(statusCode, sendOpts);
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
   * @param {object} options Options to control response behavior. See class
   *   header comment for more details.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  async sendFile(path, options = {}) {
    MustBe.string(path, /^[/]/);
    MustBe.object(options);

    const stats = await fs.stat(path);
    if (stats.isDirectory()) {
      throw new Error(`Cannot send directory: ${path}`);
    }

    const headers = this.#makeResponseHeaders('cacheable', options, {
      'content-type': () => {
        return MimeTypes.typeFromExtension(path);
      }
    });

    // TODO: Stop using Express's `response.sendFile()`, as part of the
    // long-term aim to stop using Express at all. In the short term, switch
    // to the `send` package (which is what Express bottoms out at here). In the
    // long term, do what `send` does, but even more directly (among other
    // reasons, so we can use our style of logging in it and so we don't have to
    // translate between callback and promise call styles). Things that we'll
    // have to deal with include _at least_: HEAD requests, conditional
    // requests, ranges, etags, and maybe more. As of this writing,
    // `sendContent()` above handles all of this, and can be used as a basis for
    // the code here (hopefully with a bit of DRYing out in the process).

    const doneMp = new ManualPromise();

    // In re `dotfiles`: If the caller wants to send a dotfile, that's their
    // business. (`sendFile()` by default tries to be something like a
    // "friendly" static file server, but we're lower level here.)
    const sendOpts = { dotfiles: 'allow' };

    // Note: `sendFile()` below will change the status code when appropriate,
    // to respond to range and conditional requests.
    this.#writeHead(200, headers);

    this.#expressResponse.sendFile(path, sendOpts, (err) => {
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
        return this.#sendNonContentResponseWithMessageBody(e.status, {
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
   * Issues a successful response, with no body. The reported status will always
   * be `204` ("No content"), and the response always includes a `Cache-Control`
   * header.
   *
   * This method ignores range requests entirely.
   *
   * **Note:** What this method does is different than calling {@link
   * #sendContent} with a zero-length body.
   *
   * @param {object} options Options to control response behavior. See class
   *   header comment for more details.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  async sendNoBodyResponse(options = {}) {
    const status  = 204;
    const headers = this.#makeResponseHeaders(status, options);

    return this.#writeCompleteResponse(status, headers);
  }

  /**
   * Issues a "not found" (status `404`) response, with optional body. This is
   * just a convenient shorthand for `sendError(404, ...)`.
   *
   * @param {?string} [contentType] Content type for the body. Must be valid if
   *  `body` is passed as non-`null`.
   * @param {?string|Buffer} [body] Body content.
   * @returns {boolean} `true` when the response is completed.
   */
  async sendNotFound(contentType = null, body = null) {
    return this.sendError(404, contentType, body);
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
  async sendRedirect(target, status = 302) {
    // Note: This method avoids using `express.Response.redirect()` (a) to avoid
    // ambiguity with the argument `"back"`, and (b) generally with an eye
    // towards dropping Express entirely as a dependency.

    MustBe.string(target);

    return this.#sendNonContentResponseWithMessageBody(status, {
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
  async sendRedirectBack(status = 302) {
    // Note: Express lets you ask for `referrer` (spelled properly), but the
    // actual header that's supposed to be sent is `referer` (which is of course
    // misspelled).
    const target = this.getHeaderOrNull('referer') ?? '/';
    return this.sendRedirect(target, status);
  }

  /**
   * Returns when the underlying response has been closed successfully (after
   * all of the response is believed to be sent) or has errored. Returns `true`
   * for a normal close, or throws whatever error the response reports.
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

    // Note: It's not correct to also check for `.writableEnded` here (as an
    // earlier version of this code did), because that becomes `true` _before_
    // the outgoing data is believed to be actually made it to the networking
    // stack to be sent out.
    if (res.closed || res.destroyed) {
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
   * @returns {object} The parsed version of {@link #targetString}. This is a
   * private getter because the return value is pretty ad-hoc, and we don't want
   * to expose it as part of this class's API.
   */
  get #parsedTarget() {
    if (this.#parsedTargetObject) {
      return this.#parsedTargetObject;
    }

    // Note: Node calls the target the `.url`, but it's totes _not_ actually a
    // URL, bless their innocent hearts.
    //
    // Also note: Though this framework uses Express under the covers (as of
    // this writing), and Express _does_ rewrite the underlying request's `.url`
    // in some circumstances, the way we use Express should never cause it to do
    // such rewriting. As such, it's appropriate for us to just use `.url`, and
    // not the Express-specific `.originalUrl`. (Ultimately, the hope is to drop
    // use of Express, as it provides little value to this project.)
    const targetString = this.#expressRequest.url;
    const result       = { targetString };

    if (targetString.startsWith('/')) {
      // It's the usual (most common) form for a target, namely an absolute
      // path. Use `new URL(...)` to parse and canonicalize it. This is the
      // `origin-form` as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.1>.

      // Note: An earlier version of this code said `new URL(this.targetString,
      // 'x://x')`, so as to make the constructor work given that `targetString`
      // should omit the scheme and host. However, that was totally incorrect,
      // because the _real_ requirement is for `targetString` to _always_ be
      // _just_ the path. The most notable case where the old code failed was in
      // parsing a path that began with two slashes, which would get incorrectly
      // parsed as having a host.
      const urlObj  = new URL(`x://x${targetString}`);

      // Shouldn't normally happen, but tolerate an empty pathname, converting
      // it to `/`. (`new URL()` will return an instance like this if there's
      // no slash after the hostname, but by the time we're here,
      // `targetString` is supposed to start with a slash).
      const pathnameString = (urlObj.pathname === '') ? '/' : urlObj.pathname;

      // `slice(1)` to avoid having an empty component as the first element. And
      // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
      const pathParts = Object.freeze(pathnameString.slice(1).split('/'));

      result.type           = 'origin';
      result.pathname       = new TreePathKey(pathParts, false);
      result.pathnameString = pathnameString;
      result.searchString   = urlObj.search;
    } else if (targetString === '*') {
      // This is the `asterisk-form` as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.4>.
      result.type = 'asterisk';
    } else if (/^[a-zA-Z][-+.0-9a-zA-Z]+:[/][/]/.test(targetString)) {
      // This is the `absolute-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.2>. The regex we
      // use is actually somewhat more restrictive than the spec seems to allow
      // (specifically, we require `://`), but in practice it's almost certainly
      // pointless (and arguably a bad idea) to accept anything looser. Note
      // that without our restriction (or similar), there is ambiguity between
      // this form and the `authority-form`.
      result.type = 'absolute';
    } else if (/^[-~_.%:@!$&'()*+,;=0-9a-zA-Z]+$/.test(targetString)) {
      // This is the `authority-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.3>. We are somewhat
      // _looser_ here than the spec requires, but because (as of this writing)
      // we aren't trying to do anything serious with this form, we aren't going
      // to spend a lot of (brain or CPU) cycles worrying about it. Also, as of
      // this writing, it seems that Node rejects this form entirely, so maybe
      // this is all moot.
      result.type = 'authority';
    } else {
      // Node is supposed to reject anything invalid before we get here, but
      // just in case, it's arguably better to just tag it here rather than
      // report an error. (Famous last words?)
      result.type = 'other';
    }

    Object.freeze(result);
    this.#parsedTargetObject = result;

    return result;
  }

  /**
   * Makes a set of response headers based on the given status code and
   * `options` (as per the class's public contract for same), along with a set
   * of extra headers to potentially add. Extra headers are only added if the
   * headers in `options` don't already specify them (that is, they're an
   * _underlay_).
   *
   * @param {number|string} status The response status code, or `cacheable` to
   *   indicate definite cacheability.
   * @param {object} options Result-sending options, notably including `cookies`
   *   and `headers` bindings.
   * @param {?object} [extras] Any extra headers to overlay or underlay, in the
   *   same form as accepted by {@link HttpHeaders#appendAll}.
   * @returns {object} The response headers.
   */
  #makeResponseHeaders(status, options, extras) {
    const { cookies = null, headers = null } = options ?? {};

    const result = headers ? new HttpHeaders(headers) : new HttpHeaders();

    if (cookies) {
      result.appendSetCookie(cookies);
    }

    if ((status === 'cacheable')
      || HttpUtil.responseIsCacheableFor(this.#requestMethod, status)) {
      const maxAgeMsec = options.maxAgeMsec ?? 0;
      result.append('cache-control',
        `public, max-age=${Math.floor(maxAgeMsec / 1000)}`);
    }

    if (extras) {
      result.appendAll(extras);
    }

    return result;
  }

  /**
   * Given a maximum allowed length and pending response headers, parses
   * range-related request headers, if any, and and returns information about
   * range disposition.
   *
   * @param {?number} [length] Length of the underlying response. If `null`,
   *   this method just returns a basic no-range-request success response.
   * @param {?HttpHeaders} [responseHeaders] Response headers to-be. Not used
   *   when passing `null` for `length`.
   * @returns {object} Disposition info.
   */
  #rangeInfo(length = null, responseHeaders = null) {
    const RANGE_UNIT = 'bytes';
    function status200() {
      return {
        status:  200,
        headers: { 'Accept-Ranges': RANGE_UNIT }
      };
    }

    if (length === null) {
      return status200();
    }

    const { 'if-range': ifRange, range } = this.headers;

    if (!range) {
      // Not a range request!
      return status200();
    }

    // Note: The package `range-parser` is pretty lenient about the syntax it
    // accepts. TODO: Replace with something stricter.
    const ranges = rangeParser(length, range, { combine: true });
    if ((ranges === -1) || (ranges === -2) || (ranges.type !== RANGE_UNIT)) {
      // Couldn't parse at all, not satisfiable, or wrong unit.
      return {
        error:   true,
        status:  416,
        headers: { 'Content-Range': `${RANGE_UNIT} */${length}` }
      };
    }

    if (ifRange) {
      if (/"/.test(ifRange)) {
        // The range request is conditional on an etag match.
        const { etag: etagHeader } = responseHeaders.extract('etag');
        if (etagHeader !== ifRange) {
          return status200(); // _Not_ matched.
        }
      } else {
        // The range request is a last-modified date.
        const { 'last-modified': lastModified } =
          responseHeaders.extract('last-modified');
        const lmDate = Request.#parseDate(lastModified);
        const ifDate = Request.#parseDate(ifRange);
        if ((lmDate === null) || (ifDate === null) || (lmDate > ifDate)) {
          return status200(); // _Not_ matched.
        }
      }
    }

    if (ranges.length !== 1) {
      // We don't deal with non-overlapping ranges.
      return status200();
    }

    const { start, end } = ranges[0];
    return {
      status: 206,
      headers: { 'Content-Range': `${RANGE_UNIT} ${start}-${end}/${length}` },
      start,
      end
    };
  }

  /**
   * Sends a response of the given status with a body either as given or
   * generated by default. This method is intended to be used for all "meta-ish"
   * non-content responses, such as not-founds, redirects, etc., so as to
   * provide a standard form of response (though with some flexibility).
   *
   * If the status code is allowed to be cached (per HTTP spec), the response
   * will always have a standard `Cache-Control` header.
   *
   * This method should _not_ be used for status codes that aren't ever supposed
   * to have a body at all. That said, when the request method is `head`, this
   * method will avoid sending a response body when appropriate.
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
   * @returns {Promise<boolean>} `true` when the response is completed.
   */
  #sendNonContentResponseWithMessageBody(status, options = null) {
    MustBe.number(status, { safeInteger: true, minInclusive: 0, maxInclusive: 599 });
    const { body, bodyExtra, contentType } = options ?? {};

    const method = this.#requestMethod;

    // Why `get`? Because that one's permissive, and we don't want to throw
    // unless a body is strictly disallowed. But then below, we figure out
    // whether to _actually_ send a body based on the real method.
    if (!HttpUtil.responseBodyIsAllowedFor('get', status)) {
      throw new Error(`Cannot call with status code: ${status}`);
    }

    const headers = this.#makeResponseHeaders(status, options);

    let finalBody;
    let finalContentType;

    if (!HttpUtil.responseBodyIsAllowedFor(method, status)) {
      // It's probably a HEAD request for something like a redirect.
      finalBody        = null;
      finalContentType = null;
    } else if (body) {
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

    if (finalBody) {
      if (typeof finalBody === 'string') {
        finalBody = Buffer.from(finalBody);
      }
      headers.set('content-length', finalBody.length);
      headers.set('content-type',   finalContentType);
    }

    return this.#writeCompleteResponse(status, headers, finalBody);
  }

  /**
   * Kicks off the response procedure by emitting the status code and response
   * headers. This is _approximately_ a wrapper around
   * `HttpResponse.writeHead()` (and similar), meant to hide all the
   * shouldn't-be-differences between the concrete protocol implementations.
   *
   * @param {number} statusCode The HTTP(ish) status code.
   * @param {HttpHeaders} headers Response headers.
   */
  #writeHead(statusCode, headers) {
    const res = this.#expressResponse;

    res.status(statusCode);

    // We'd love to use `response.setHeaders()` here, but as of this writing
    // (checked on Node 21.4), there are three issues which prevent its use:
    //
    // * It is not implemented on `Http2ServerResponse`. This is filed as Node
    //   issue #51573 <https://github.com/nodejs/node/issues/51573>.
    // * Calling it on a `Headers` object will cause it to fail to handle
    //   multiple `Set-Cookies` headers correctly. This is filed as Node issue
    //   #51599 <https://github.com/nodejs/node/issues/51599>.
    // * When used on an HTTP1 server (that is not the HTTP2 protocol), it
    //   forces header names to lower case. Though not against the spec, it is
    //   atypical to send lowercased headers in HTTP1.

    const entries = headers.entriesForVersion(this.#expressRequest.httpVersionMajor);
    for (const [name, value] of entries) {
      res.setHeader(name, value);
    }
  }

  /**
   * Writes and finishes a response. This does not do anything to adjust the
   * status code, headers, or body. That said, this _does_ do a modicum of error
   * checking, and will throw:
   *
   * * if `body !== null` and...
   *   * the request method was `HEAD` and the status is successful (`2xx`).
   *   * the `statusCode` definitely indicates that a body shouldn't be present.
   *   * either the `content-type` or `content-length` header is missing.
   * * if `body === null` and...
   *   * either the `content-type` or `content-length` header is present.
   *
   * To be clear, this is far from an exhaustive list of possible error checks.
   * It is meant to catch the most common and blatant caller problems.
   *
   * @param {number} status The HTTP(ish) status code.
   * @param {HttpHeaders} headers Response headers.
   * @param {?Buffer} [body] Body, or `null` not to include one in the response.
   * @returns {boolean} `true` when the response is completed.
   */
  async #writeCompleteResponse(status, headers, body = null) {
    if (body) {
      if (!HttpUtil.responseBodyIsAllowedFor(this.#requestMethod, status)) {
        throw new Error(`Non-null body incompatible with \`${this.#requestMethod}\` and status ${status}.`);
      } else if (!headers.hasAll('content-length', 'content-type')) {
        throw new Error('Non-null body requires `content-*` headers.');
      }
    } else {
      if (HttpUtil.responseBodyIsRequiredFor(this.#requestMethod, status)) {
        throw new Error(`Null body incompatible with \`${this.#requestMethod}\` and status ${status}.`);
      } else if (headers.hasAny('content-length', 'content-type')) {
        throw new Error('Null body incompatible with `content-*` headers.');
      }
    }

    const res = this.#expressResponse;

    this.#writeHead(status, headers);

    if (body) {
      res.end(body);
    } else {
      res.end();
    }

    return this.whenResponseDone();
  }


  //
  // Static members
  //

  /**
   * Given a logger created by this class, returns the request ID it logs
   * with.
   *
   * @param {?IntfLogger} logger The logger.
   * @returns {?string} The ID string, or `null` if `logger === null`.
   */
  static idFromLogger(logger) {
    return logger?.$meta.lastContext ?? null;
  }

  /**
   * Extracts a string error code from the given `Error`, or returns a generic
   * "unknown error" if there's nothing else reasonable.
   *
   * @param {*} error The error to extract from.
   * @returns {string} The extracted code.
   */
  static #extractErrorCode(error) {
    const shortenAndFormat = (str) => {
      return str.slice(0, 32).toLowerCase()
        .replaceAll(/[_ ]/g, '-')
        .replaceAll(/[^-a-z0-9]/g, '');
    };

    if (error instanceof Error) {
      if (error.code) {
        return error.code.toLowerCase().replaceAll(/_/g, '-');
      } else if (error.message) {
        return shortenAndFormat(error.message);
      }
    } else if (AskIf.string(error)) {
      return shortenAndFormat(error);
    }

    return 'err-unknown';
  }

  /**
   * Parses an (alleged) HTTP date string.
   *
   * @param {?string} dateString An (alleged) HTTP date string.
   * @returns {?number} A millisecond time if successfully parsed, or `null` if
   *   not.
   */
  static #parseDate(dateString) {
    // Note: Technically, HTTP date strings are all supposed to be GMT, but we
    // just let `Date.parse()` blithely accept anything it wants.
    const result = Date.parse(dateString);

    return (typeof result === 'number') ? result : null;
  }

  /**
   * Cleans up request headers for logging.
   *
   * @param {object} headers Original request headers.
   * @returns {object} Cleaned up version.
   */
  static #sanitizeRequestHeaders(headers) {
    const result = { ...headers };

    delete result[':authority'];
    delete result[':method'];
    delete result[':path'];
    delete result[':scheme'];
    delete result.host;

    // Non-obvious: This deletes the symbol property `http2.sensitiveHeaders`
    // from the result (whose array is a value of header names that, per Node
    // docs, aren't supposed to be compressed due to poor interaction with
    // desirable cryptography properties). This _isn't_ supposed to actually
    // delete the headers _named_ by this value.
    delete result[http2.sensitiveHeaders];

    return result;
  }

  /**
   * Cleans up response headers for logging.
   *
   * @param {object} headers Original response headers.
   * @returns {object} Cleaned up version.
   */
  static #sanitizeResponseHeaders(headers) {
    const result = { ...headers };

    delete result[':status'];
    delete result['content-length'];

    return result;
  }
}
