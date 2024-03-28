// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage } from 'node:http';
import { Http2ServerRequest } from 'node:http2';

import { TreePathKey } from '@this/collections';
import { FormatUtils, IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { Cookies } from '#x/Cookies';
import { HostInfo } from '#x/HostInfo';
import { HttpHeaders } from '#x/HttpHeaders';
import { RequestContext } from '#x/RequestContext';


/**
 * Representation of a received and in-progress HTTP(ish) request. This is meant
 * as a replacement for the data-bearing aspects of Node's built-in request
 * objects, offering a cleaner / friendlier interface.
 *
 * This class includes a static method, {@link #fromNodeRequest}, which
 * "imports" data from low-level Node request objects, but it's also just fine
 * to construct an instance more directly.
 *
 * **Note:** This interface does not define its API to have any understanding of
 * running a system behind a reverse proxy. For example, `Forwarded` and related
 * headers have no special meaning to this interface.
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
   * @type {RequestContext} Information about the incoming "context" of a
   * request.
   */
  #requestContext;

  /**
   * Request headers.
   *
   * @type {HttpHeaders}
   */
  #requestHeaders;

  /**
   * The protocol name.
   *
   * @type {string}
   */
  #protocolName;

  /**
   * @type {HttpHeaders} HTTP-2-ish "pseudo-headers" that came with the request
   * or were synthesized from an HTTP-1-ish request, with keys stripped of their
   * colon (`:`) prefixes.
   */
  #pseudoHeaders;

  /**
   * The request method, downcased.
   *
   * @type {string}
   */
  #requestMethod;

  /**
   * The parsed cookies, or `null` if not yet figured out.
   *
   * @type {?Cookies}
   */
  #cookies = null;

  /**
   * @type {HostInfo} The host (a/k/a "authority") info, or `null` if not yet
   * figured out.
   */
  #hostInfo = null;

  /**
   * @type {{ targetString: string, type: ?string, pathname: ?TreePathKey,
   * pathnameString: ?string, searchString: ?string }} The target string of the
   * request (the thing that Node calls a `url` despite it not really being one,
   * bless their innocent hearts), along with a type indicator and parsed
   * components depending on the type.
   */
  #parsedTargetObject = null;

  /**
   * @type {?object} The result of {@link #infoForLog}, or `null` if not yet
   * calculated.
   */
  #infoForLog = null;

  /**
   * @type {?string} The value of {@link #urlForLog}, or `null` if not yet
   * calculated.
   */
  #urlForLog = null;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration of the instance. Most properties are
   *   required.
   * @param {RequestContext} config.context Information about the incoming
   *   "context" of a request. (This information isn't provided by the standard
   *   Node HTTP-ish libraries.)
   * @param {HttpHeaders} config.headers Headers that came with the request.
   * @param {?IntfLogger} [config.logger] Logger to use as a base, or `null` to
   *   not do any logging. If passed as non-`null`, the actual logger instance
   *   will be one that includes an additional subtag representing a new
   *   unique(ish) ID for the request.
   * @param {string} config.protocolName The protocol name. This is expected
   *   to be a lowercase name followed by a dash and a version, e.g.
   *   `http-1.1`.
   * @param {HttpHeaders} config.pseudoHeaders HTTP-2-ish "pseudo-headers"
   *   that came with the request or were synthesized based on an HTTP-1-ish
   *   request, with keys stripped of their colon (`:`) prefixes.
   */
  constructor(config) {
    const {
      context, headers, logger = null, protocolName, pseudoHeaders
    } = config;

    this.#protocolName   = MustBe.string(protocolName);
    this.#pseudoHeaders  = MustBe.instanceOf(pseudoHeaders, HttpHeaders);
    this.#requestContext = MustBe.instanceOf(context, RequestContext);
    this.#requestHeaders = MustBe.instanceOf(headers, HttpHeaders);
    this.#requestMethod  = MustBe.string(pseudoHeaders.get('method')).toLowerCase();

    const targetString = MustBe.string(pseudoHeaders.get('path'));
    this.#parsedTargetObject = { targetString, type: null };

    if (logger) {
      this.#id     = logger.$meta.makeId();
      this.#logger = logger[this.#id];
    }
  }

  /**
   * @returns {RequestContext} Information about the context in which this
   * instance was received.
   */
  get context() {
    return this.#requestContext;
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

  /** @returns {HttpHeaders} Incoming headers of the request. */
  get headers() {
    return this.#requestHeaders;
  }

  /**
   * @returns {HostInfo} Info about the host (a/k/a the "authority") being asked
   * to respond to this request. This is the value of the synthetic `:authority`
   * header of an HTTP-2 request if available, or the regular `Host` header of
   * an HTTP-1 request, plus port information. If there is no authority
   * information present in the request, it is treated as if it were specified
   * as just `localhost`.
   *
   * The `port` of the returned object is as follows (in order):
   *
   * * If the `:authority` or `Host` header has a port, use that.
   * * If the `:scheme` is present and recognized, use its standard port.
   * * If the connection has a "declared listening port," use that.
   * * If the connection has a known listening port, use that.
   * * Otherwise, use `0` for the port.
   */
  get host() {
    if (!this.#hostInfo) {
      // Note: We use `#pseudoHeaders` to hold the `Host` header of an
      // HTTP-1-ish request.

      const authority = this.#pseudoHeaders.get('authority') ?? null;
      const scheme    = this.#pseudoHeaders.get('scheme')    ?? null;

      // If there's a `scheme` we recognize, we can use it to know the port to
      // use in case `authority` didn't come with one. If not, we just use the
      // request context. (Note: We should always have a `scheme` for HTTP-2-ish
      // requests.)
      let fallbackPort;
      switch (scheme) {
        case 'http':  { fallbackPort = 80;  break; }
        case 'https': { fallbackPort = 443; break; }
        default: {
          fallbackPort = this.#requestContext.interface.port;
          break;
        }
      }

      this.#hostInfo = authority
        ? HostInfo.safeParseHostHeader(authority, fallbackPort)
        : HostInfo.localhostInstance(fallbackPort);
    }

    return this.#hostInfo;
  }

  /**
   * @returns {?string} The unique-ish request ID, or `null` if there is none
   * (which will happen if there is no associated logger).
   */
  get id() {
    return this.#id;
  }

  /**
   * Gets all reasonably-logged info about the request that was made.
   *
   * **Note:** The `headers` in the result omits anything that is redundant with
   * respect to other parts of the return value. (E.g., the `cookie` header is
   * omitted if it was able to be parsed.)
   *
   * @returns {object} Loggable information about the request. The result is
   *   always frozen.
   */
  get infoForLog() {
    if (!this.#infoForLog) {
      const { cookies, method, origin, urlForLog } = this;

      const result = {
        origin:   FormatUtils.addressPortString(origin.address, origin.port),
        protocol: this.protocolName,
        method,
        url:      urlForLog,
        headers:  this.#sanitizeRequestHeaders()
      };

      if (cookies.size !== 0) {
        result.cookies = Object.freeze(Object.fromEntries(cookies));
        delete result.headers.cookie;
      }

      Object.freeze(result.headers);
      this.#infoForLog = Object.freeze(result);
    }

    return this.#infoForLog;
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
   * @returns {{ address: string, port: number }} The IP address and port of
   * the origin (remote side) of the request.
   */
  get origin() {
    return this.#requestContext.origin;
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
   *
   * **Note:** The name of this field matches the equivalent field of the
   * standard `URL` class.
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
   * @returns {string} The search a/k/a query portion of {@link #targetString},
   * as an unparsed string, or `''` (the empty string) if there is no search
   * string. The result includes anything at or after the first question mark
   * (`?`) in the URL. In the case of a "degenerate" search of _just_ a question
   * mark with nothing after, this returns `''`.
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
   * {@link IncomingMessage#url}, even though it's not actually a URL per se. We
   * chose to diverge from Node for the sake of clarity.
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
  get urlForLog() {
    if (!this.#urlForLog) {
      const { host }               = this;
      const { targetString, type } = this.#parsedTarget;
      const prefix                 = `//${host.namePortString}`;

      this.#urlForLog = (type === 'origin')
        ? `${prefix}${targetString}`
        : `${prefix}:${type}=${targetString}`;
    }

    return this.#urlForLog;
  }

  /**
   * Gets a request header, by name.
   *
   * @param {string} name The header name.
   * @returns {?string|Array<string>} The corresponding value, or `null` if
   *   there was no such header.
   */
  getHeaderOrNull(name) {
    return this.headers[name] ?? null;
  }

  /**
   * @returns {object} {@link #parsedTargetObject}, filling it out first if it
   * had not already been set up. This is a private getter because the return
   * value is pretty ad-hoc, and we don't want to expose it as part of this
   * class's API.
   */
  get #parsedTarget() {
    const target = this.#parsedTargetObject;

    if (target.type !== null) {
      return target;
    }

    const { targetString } = target;

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
      // freezing `parts` lets `new TreePathKey()` avoid making a copy.
      const pathParts = Object.freeze(pathnameString.slice(1).split('/'));

      target.type           = 'origin';
      target.pathname       = new TreePathKey(pathParts, false);
      target.pathnameString = pathnameString;
      target.searchString   = urlObj.search;
    } else if (targetString === '*') {
      // This is the `asterisk-form` as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.4>.
      target.type = 'asterisk';
    } else if (/^[a-zA-Z][-+.0-9a-zA-Z]+:[/][/]/.test(targetString)) {
      // This is the `absolute-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.2>. The regex we
      // use is actually somewhat more restrictive than the spec seems to allow
      // (specifically, we require `://`), but in practice it's almost certainly
      // pointless (and arguably a bad idea) to accept anything looser. Note
      // that without our restriction (or similar), there is ambiguity between
      // this form and the `authority-form`.
      target.type = 'absolute';
    } else if (/^[-~_.%:@!$&'()*+,;=0-9a-zA-Z]+$/.test(targetString)) {
      // This is the `authority-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.3>. We are somewhat
      // _looser_ here than the spec requires, but because (as of this writing)
      // we aren't trying to do anything serious with this form, we aren't going
      // to spend a lot of (brain or CPU) cycles worrying about it. Also, as of
      // this writing, it seems that Node rejects this form entirely, so maybe
      // this is all moot.
      target.type = 'authority';
    } else {
      // Node is supposed to reject anything invalid before we get here, but
      // just in case, it's arguably better to just tag it here rather than
      // report an error. (Famous last words?)
      target.type = 'other';
    }

    return Object.freeze(target);
  }

  /**
   * Transforms and cleans up request headers for logging.
   *
   * @returns {object} Cleaned up headers, as a plain object with deeply-frozen
   *   contents. (It can't itself be frozen because the caller might need to
   *   tweak it.)
   */
  #sanitizeRequestHeaders() {
    const { headers }   = this;

    const result    = {};
    const setCookie = [];

    for (const [name, value] of this.#pseudoHeaders) {
      switch (name) {
        case 'authority':
        case 'method':
        case 'path':
        case 'scheme': {
          // These are all headers to ignore for the purposes of logging,
          // because they're redundant in the larger context.
          continue;
        }
        default: {
          result[`:${name}`] = value;
        }
      }
    }

    for (const [name, value] of headers.entries()) {
      switch (name) {
        case 'host': {
          // As above, ignore because it's redundant.
          continue;
        }
        case 'set-cookie': {
          // Non-obvious: Though not a request header, there's nothing stopping
          // a client from sending one or more `Set-Cookie` headers, and the
          // `Headers` class (the base class of `HttpHeaders`) always treats
          // these specially and can end up reporting more than one when
          // iterating. (This is the only header which gets that special
          // treatment.)
          if (setCookie.length === 0) {
            result[name] = setCookie;
          }
          setCookie.push(value);
          break;
        }
        default: {
          result[name] = value;
          break;
        }
      }
    }

    if (setCookie.length !== 0) {
      Object.freeze(setCookie);
    }

    return result;
  }


  //
  // Static members
  //

  /**
   * Constructs an instance based on a low-level Node HTTP-ish request object.
   *
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @param {RequestContext} context Information about the request not
   *   represented in `request`.
   * @param {?IntfLogger} logger Logger to use as a base, or `null` to not do
   *   any logging. If passed as non-`null`, the actual logger instance will be
   *   one that includes an additional subtag representing a new unique(ish) ID
   *   for the request.
   * @returns {IncomingRequest} Instance with data based on a low-level Node
   *   request (etc.).
   */
  static fromNodeRequest(request, context, logger) {
    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    MustBe.object(request);

    const { pseudoHeaders, headers } = IncomingRequest.#extractHeadersFrom(request);

    return new IncomingRequest({
      context,
      headers,
      logger,
      protocolName: `http-${request.httpVersion}`,
      pseudoHeaders
    });
  }

  /**
   * Extracts the two sets of headers from a low-level request object.
   *
   * @param {IncomingMessage|Http2ServerRequest} request Request object.
   * @returns {{ headers: HttpHeaders, pseudoHeaders: HttpHeaders }} The
   *   extracted headers.
   */
  static #extractHeadersFrom(request) {
    const modernHttp    = (request.httpVersionMajor >= 2);
    const headers       = new HttpHeaders();
    const pseudoHeaders = new HttpHeaders();

    // We use `request.rawHeaders` here, which is a flat array of strings, with
    // alternating header names (keys) and values. Notably, the low-level Node
    // library only bothers creating its own non-raw headers objects if
    // explicitly asked (and we don't), so our "manual" work here should end up
    // saving a bit of overall work (because we don't have to let Node construct
    // a `headers` object only to rework it into the two objects we actually
    // need).

    let pendingKey = null;
    for (const s of request.rawHeaders) {
      if (pendingKey === null) {
        pendingKey = s;
        continue;
      }

      let key = modernHttp ? pendingKey : pendingKey.toLowerCase();
      pendingKey = null;

      if (modernHttp && (key[0] === ':')) {
        // Handle the small handful of expected pseudo-header keys directly, and
        // `slice()` the rest.
        switch (pendingKey) {
          case ':authority': { key = 'authority'; break; }
          case ':method':    { key = 'method';    break; }
          case ':path':      { key = 'path';      break; }
          case ':scheme':    { key = 'scheme';    break; }
          case ':status':    { key = 'status';    break; }
          default: {
            key = key.slice(1);
            break;
          }
        }
        pseudoHeaders.set(key, s);
      } else {
        switch (key) {
          case 'age': case 'authorization': case 'content-length':
          case 'content-type': case 'etag': case 'expires': case 'from':
          case 'if-modified-since': case 'if-unmodified-since':
          case 'last-modified': case 'location': case 'max-forwards':
          case 'proxy-authorization': case 'referer': case 'retry-after':
          case 'server': case 'user-agent': {
            // Duplicates of these headers are discarded (not combined), per
            // docs for `IncomingMessage.headers`.
            headers.set(key, s);
            break;
          }
          case 'host': {
            // Like above, duplicates are discarded. But in addition, for
            // HTTP-1-ish requests, this becomes the synthesized `:authority`
            // pseudo-header.
            headers.set(key, s);
            if (!modernHttp) {
              pseudoHeaders.set('authority', s);
            }
            break;
          }
          default: {
            // Everything else gets `append()`ed, meaning that duplicates are
            // combined. There are special rules for handling `cookie` and
            // `set-cookie` headers, but those are taken care of for us by
            // `HttpHeaders`.
            headers.append(key, s);
            break;
          }
        }
      }
    }

    // Fill in the other pseudo-headers when given an HTTP-1-ish request.
    if (!modernHttp) {
      pseudoHeaders.set('method', request.method);
      pseudoHeaders.set('path',   request.url);
      // Note: No way to determine `:scheme` for these requests.
    }

    Object.freeze(headers);
    Object.freeze(pseudoHeaders);
    return { headers, pseudoHeaders };
  }
}
