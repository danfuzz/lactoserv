// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage, ServerResponse } from 'node:http';
import * as http2 from 'node:http2';

import { ManualPromise } from '@this/async';
import { TreePathKey } from '@this/collections';
import { FormatUtils, IntfLogger } from '@this/loggy';
import { Cookies, HostInfo, HttpResponse } from '@this/net-util';
import { AskIf, MustBe } from '@this/typey';

import { WranglerContext } from '#x/WranglerContext';


/**
 * Representation of an in-progress HTTP(ish) request, including both request
 * data _and_ ways to send a response.
 *
 * Ultimately, this class wraps both the request and response objects that are
 * provided by the underlying Node libraries, though it is intended to offer a
 * simpler (less crufty) and friendlier interface to them.
 *
 * **Note:** This class does not implement any understanding of reverse proxy
 * headers. It is up to constructors of this class to pass appropriate
 * constructor parameters to get this class to do the right thing when running
 * behind a reverse proxy. That said, as of this writing there isn't anything
 * that actually does that. See
 * <https://github.com/danfuzz/lactoserv/issues/213>.
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

  /** @type {IncomingMessage} Underlying HTTP(ish) request object. */
  #coreRequest;

  /** @type {ServerResponse} Underlying HTTP(ish) response object. */
  #coreResponse;

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
   * @type {?string} The value of {@link #urlForLogging}, or `null` if not yet
   * calculated.
   */
  #urlForLogging = null;

  /**
   * @type {ManualPromise<boolean>} Manual promise whose actual-promise resolves
   * to `true` when the response to this request is complete, or is rejected
   * with whatever error caused it to fail.
   */
  #responsePromise = new ManualPromise();

  /**
   * Constructs an instance.
   *
   * @param {WranglerContext} context Most-specific context that was responsible
   *   for constructing this instance.
   * @param {IncomingMessage} request Request object.
   * @param {ServerResponse} response Response object.
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   */
  constructor(context, request, response, logger) {
    this.#outerContext = MustBe.instanceOf(context, WranglerContext);

    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    this.#coreRequest   = MustBe.object(request);
    this.#coreResponse  = MustBe.object(response);
    this.#requestMethod = request.method.toLowerCase();
    this.#protocolName  = `http-${request.httpVersion}`;

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
   * @returns {object} Map of all incoming headers to their values, as defined
   * by Node's `IncomingMessage.headers`.
   */
  get headers() {
    // TODO: This should be a `HttpHeaders` object.
    return this.#coreRequest.headers;
  }

  /**
   * @returns {HostInfo} Info about the `Host` header (or equivalent). If there
   * is no header (etc.), it is treated as if it were specified as just
   * `localhost`.
   *
   * The `port` of the returned object is as follows:
   *
   * * If the `Host` header has a port, use that.
   * * If the connection has a "declared listening port," use that.
   * * If the connection has a known listening port, use that.
   * * Otherwise, use `0` for the port.
   */
  get host() {
    if (!this.#host) {
      const req = this.#coreRequest;

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
   * order to send the request. That is, `https*` won't be the value of this
   * property.
   */
  get protocolName() {
    return this.#protocolName;
  }

  /**
   * @returns {boolean} An indication of whether this instance believes the
   * underlying response to have been completed (either successfully or not).
   */
  get responseCompleted() {
    return this.#responsePromise.isSettled
      && this.#coreResponse.writableEnded;
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
   * representation of the incoming request including both the host and target,
   * in the form of a protocol-less URL in most cases (and something vaguely
   * URL-like when the target isn't the usual `origin` type).
   *
   * This value is meant for logging, and specifically _not_ for any routing or
   * other more meaningful computation (hence the name).
   */
  get urlForLogging() {
    if (!this.#urlForLogging) {
      const { host }               = this;
      const { targetString, type } = this.#parsedTarget;
      const prefix                 = `//${host.namePortString}`;

      this.#urlForLogging = (type === 'origin')
        ? `${prefix}${targetString}`
        : `${prefix}:${type}=${targetString}`;
    }

    return this.#urlForLogging;
  }

  /**
   * Gets a request header, by name.
   *
   * @param {string} name The header name.
   * @returns {?string|Array<string>} The corresponding value, or `null` if
   *   there was no such header.
   */
  getHeaderOrNull(name) {
    return this.#coreRequest.headers[name] ?? null;
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
    let responseError = null;

    try {
      await this.whenResponseDone();
    } catch (e) {
      responseError = e;
    }

    const connectionError = this.#outerContext.socket.errored ?? null;
    const res             = this.#coreResponse;
    const statusCode      = res.statusCode;
    const headers         = res.getHeaders();
    const contentLength   = headers['content-length'] ?? 0;

    const result = {
      ok: !(responseError || connectionError),
      contentLength,
      statusCode,
      headers: Request.#sanitizeResponseHeaders(headers),
    };

    const fullErrors = [];
    let   errorStr   = null;

    if (responseError) {
      const code = Request.#extractErrorCode(responseError);

      fullErrors.push(responseError);
      result.responseError = code;
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
   * Sends a response to this request, by asking the given response object to
   * write itself to this isntance's underlying `http.ServerResponse` object (or
   * similar).
   *
   * @param {HttpResponse} response The response to send.
   * @returns {boolean} `true` when the response is completed.
   * @throws {Error} Thrown if there is any trouble sending the response.
   */
  respond(response) {
    const result = response.writeTo(this.#coreResponse);

    this.#responsePromise.resolve(result);
    return result;
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
    return this.#responsePromise.promise;
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
    const targetString = this.#coreRequest.url;
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


  //
  // Static members
  //

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
