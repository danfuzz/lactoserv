// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage } from 'node:http';
import { Http2ServerRequest, sensitiveHeaders as Http2SensitiveHeaders }
  from 'node:http2';

import { TreePathKey } from '@this/collections';
import { FormatUtils } from '@this/loggy-intf';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { Cookies } from '#x/Cookies';
import { HostInfo } from '#x/HostInfo';
import { IntfIncomingRequest } from '#x/IntfIncomingRequest';
import { RequestContext } from '#x/RequestContext';


/**
 * Representation of an in-progress HTTP(ish) request, which is being serviced
 * by Node's low-level networking code.
 *
 * Ultimately, this class wraps the request object that comes from the
 * underlying Node libraries, though it is intended to offer a simpler (less
 * crufty) and friendlier interface to them.
 *
 * **Note:** This class does not implement any understanding of reverse proxy
 * headers. It is up to constructors of this class to pass appropriate
 * constructor parameters to get this class to do the right thing when running
 * behind a reverse proxy. That said, as of this writing there isn't anything
 * that actually does that. See
 * <https://github.com/danfuzz/lactoserv/issues/213>.
 *
 * @implements {IntfIncomingRequest}
 */
export class IncomingRequest {
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
   * @type {RequestContext} Information about the request not available from
   * {@link #coreRequest}.
   */
  #requestContext;

  /**
   * @type {IncomingMessage|Http2ServerRequest} Underlying HTTP(ish) request
   * object.
   */
  #coreRequest;

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
   * @type {?object} The result of {@link #getLoggableRequestInfo}, or `null` if
   * not yet calculated.
   */
  #loggableRequestInfo = null;

  /**
   * @type {?string} The value of {@link #urlForLogging}, or `null` if not yet
   * calculated.
   */
  #urlForLogging = null;

  /**
   * Constructs an instance.
   *
   * @param {RequestContext} context Information about the request not
   *   represented in `request`.
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   */
  constructor(context, request, logger) {
    this.#requestContext = MustBe.instanceOf(context, RequestContext);

    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    this.#coreRequest   = MustBe.object(request);
    this.#requestMethod = request.method.toLowerCase();
    this.#protocolName  = `http-${request.httpVersion}`;

    if (logger) {
      this.#id     = logger.$meta.makeId();
      this.#logger = logger[this.#id];
    }
  }

  /** @override */
  get cookies() {
    if (!this.#cookies) {
      const cookieStr = this.getHeaderOrNull('cookie');
      const result    = cookieStr ? Cookies.parse(cookieStr) : null;

      this.#cookies = result ? Object.freeze(result) : Cookies.EMPTY;
    }

    return this.#cookies;
  }

  /** @override */
  get headers() {
    // TODO: This should be an `HttpHeaders` object.
    return this.#coreRequest.headers;
  }

  /** @override */
  get host() {
    if (!this.#host) {
      const req = this.#coreRequest;

      // Note: `authority` is used by HTTP2.
      const { authority } = req;
      const localPort     = this.#requestContext.interface.port;

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

  /** @override */
  get id() {
    return this.#id;
  }

  /** @override */
  get logger() {
    return this.#logger;
  }

  /** @override */
  get method() {
    return this.#requestMethod;
  }

  /** @override */
  get origin() {
    return this.#requestContext.origin;
  }

  /** @override */
  get pathname() {
    return this.#parsedTarget.pathname ?? null;
  }

  /** @override */
  get pathnameString() {
    return this.#parsedTarget.pathnameString ?? null;
  }

  /** @override */
  get protocolName() {
    return this.#protocolName;
  }

  /** @override */
  get searchString() {
    return this.#parsedTarget.searchString;
  }

  /** @override */
  get targetString() {
    return this.#parsedTarget.targetString;
  }

  /** @override */
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

  /** @override */
  getHeaderOrNull(name) {
    return this.#coreRequest.headers[name] ?? null;
  }

  /** @override */
  getLoggableRequestInfo() {
    if (!this.#loggableRequestInfo) {
      const {
        cookies,
        headers,
        method,
        origin,
        urlForLogging
      } = this;

      const result = {
        origin:   FormatUtils.addressPortString(origin.address, origin.port),
        protocol: this.protocolName,
        method,
        url:      urlForLogging,
        headers:  IncomingRequest.#sanitizeRequestHeaders(headers)
      };

      if (cookies.size !== 0) {
        result.cookies = Object.freeze(Object.fromEntries(cookies));
        delete result.headers.cookie;
      }

      Object.freeze(result.headers);
      this.#loggableRequestInfo = Object.freeze(result);
    }

    return this.#loggableRequestInfo;
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

    // Non-obvious: Though not a request header, there's nothing stopping a
    // client from sending one or more `Set-Cookie` headers, and Node always
    // reports these as an array. (This is the only header which gets that
    // special treatment.) The caller of this method ultimately wants a
    // deep-frozen result, and it makes more sense to deal with the so-required
    // special case here.
    const setCookie = result['set-cookie'];
    if (setCookie) {
      result['set-cookie'] = Object.freeze([...setCookie]);
    }

    // Non-obvious: This deletes the symbol property `sensitiveHeaders` from the
    // result (whose value is an array of header names that, per Node docs,
    // aren't supposed to be compressed due to poor interaction with desirable
    // cryptography properties). This _isn't_ supposed to actually delete the
    // headers _named_ by this value.
    delete result[Http2SensitiveHeaders];

    return result;
  }
}
