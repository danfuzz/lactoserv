// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';

import { Cookies } from '#x/Cookies';
import { EndpointAddress } from '#x/EndpointAddress';
import { HostInfo } from '#x/HostInfo';
import { HttpHeaders } from '#x/HttpHeaders';
import { HttpUtil } from '#x/HttpUtil';
import { RequestContext } from '#x/RequestContext';
import { TypeNodeRequest } from '#x/TypeNodeRequest';


/**
 * Representation of a received and in-progress HTTP-ish request. This is meant
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
   * Logger to use for this instance, or `null` if the instance is not doing
   * logging.
   *
   * @type {?IntfLogger}
   */
  #logger = null;

  /**
   * Request ID, or `null` if the instance is not doing logging.
   *
   * @type {?string}
   */
  #id = null;

  /**
   * Information about the incoming "context" of a request.
   *
   * @type {RequestContext}
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
   * HTTP2-ish "pseudo-headers" that came with the request or were synthesized
   * from an HTTP1-ish request, with keys stripped of their colon (`:`)
   * prefixes.
   *
   * @type {HttpHeaders}
   */
  #pseudoHeaders;

  /**
   * The request method, downcased.
   *
   * @type {string}
   */
  #requestMethod;

  /**
   * The request body, or `null` if the request did not come with a body.
   *
   * @type {?Buffer}
   */
  #body;

  /**
   * The parsed cookies, or `null` if not yet figured out.
   *
   * @type {?Cookies}
   */
  #cookies = null;

  /**
   * The host (a/k/a "authority") info, or `null` if not yet figured out.
   *
   * @type {HostInfo}
   */
  #hostInfo = null;

  /**
   * The target string of the request (the thing that Node calls a `url` despite
   * it not really being one, bless their innocent hearts), along with a type
   * indicator and parsed components depending on the type.
   *
   * @type {{ targetString: string, type: ?string, pathname: ?PathKey,
   *   pathnameString: ?string, searchString: ?string }}
   */
  #parsedTargetObject = null;

  /**
   * The result of {@link #infoForLog}, or `null` if not yet calculated.
   *
   * @type {?object}
   */
  #infoForLog = null;

  /**
   * The value of {@link #urlForLog}, or `null` if not yet calculated.
   *
   * @type {?string}
   */
  #urlForLog = null;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration of the instance. Most properties are
   *   required.
   * @param {?Buffer} [config.body] The request body, or `null` if the request
   *   did not come with a body.
   * @param {RequestContext} config.context Information about the incoming
   *   "context" of a request. (This information isn't provided by the standard
   *   Node HTTP-ish libraries.)
   * @param {HttpHeaders} config.headers Headers that came with the request.
   * @param {?IntfLogger} [config.logger] Logger to use as a base, or `null` to
   *   not do any logging. If passed as non-`null`, the actual logger instance
   *   will be one that includes an additional subtag representing a new
   *   unique-ish ID for the request.
   * @param {string} config.protocolName The protocol name. This is expected to
   *   be a lowercase name followed by a dash and a version, e.g. `http-1.1`.
   * @param {HttpHeaders} config.pseudoHeaders HTTP2-ish "pseudo-headers" that
   *   came with the request or were synthesized based on an HTTP1-ish request,
   *   with keys stripped of their colon (`:`) prefixes.
   */
  constructor(config) {
    const {
      body = null, context, headers, logger = null, protocolName, pseudoHeaders
    } = config;

    this.#body           = (body === null) ? null : MustBe.instanceOf(body, Buffer);
    this.#protocolName   = MustBe.string(protocolName);
    this.#pseudoHeaders  = MustBe.instanceOf(pseudoHeaders, HttpHeaders);
    this.#requestContext = MustBe.instanceOf(context, RequestContext);
    this.#requestHeaders = MustBe.instanceOf(headers, HttpHeaders);
    this.#requestMethod  = IncomingRequest.#requestMethodFromPseudoHeaders(pseudoHeaders);

    const targetString = MustBe.string(pseudoHeaders.get('path'));
    this.#parsedTargetObject = Object.freeze({ targetString, type: null });

    if (logger) {
      this.#id     = logger.$meta.makeId();
      this.#logger = logger[this.#id];
    }
  }

  /**
   * @returns {?Buffer} The request body, or `null` if this instance does not
   * have an associated body.
   */
  get body() {
    return this.#body;
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
      const cookieStr = this.getHeaderElseNull('cookie');
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
   * header of an HTTP2 request if available, or the regular `Host` header of an
   * HTTP1 request, plus port information. If there is no authority information
   * present in the request, it is treated as if it were specified as just
   * `localhost`.
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
      // Note: We use `#pseudoHeaders` to hold the `Host` header of an HTTP1-ish
      // request.

      const authority = this.#pseudoHeaders.get('authority') ?? null;
      const scheme    = this.#pseudoHeaders.get('scheme')    ?? null;

      // If there's a `scheme` we recognize, we can use it to know the port to
      // use in case `authority` didn't come with one. If not, we just use the
      // request context. (Note: We should always have a `scheme` for HTTP2-ish
      // requests.)
      let fallbackPort;
      switch (scheme) {
        case 'http':  { fallbackPort = 80;  break; }
        case 'https': { fallbackPort = 443; break; }
        default: {
          fallbackPort = this.#requestContext.interface.portNumber;
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
        origin,
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
   * @returns {string} The HTTP-ish request method, downcased, e.g. commonly
   * one of `'get'`, `'head'`, or `'post'`.
   */
  get method() {
    return this.#requestMethod;
  }

  /**
   * @returns {EndpointAddress} Address of the origin (remote side) of the
   * request.
   */
  get origin() {
    return this.#requestContext.origin;
  }

  /**
   * @returns {?PathKey} Parsed path key form of {@link #pathnameString}, or
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
   * This is generally a string starting with `http-` and ending with the dotted
   * version. This corresponds to the (unencrypted) protocol being used over the
   * (possibly encrypted) transport, and has nothing to do _per se_ with the
   * port number which the remote side of this request connected to in order to
   * send the request. That is, `https*` won't be the value of this property.
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
   * HTTP-ish request. In the common case of the target being a path to a
   * resource, colloquially speaking, this is the suffix of the URL-per-se
   * starting at the first slash (`/`) after the host identifier. That said,
   * there are other non-path forms for a target. See
   * <https://www.rfc-editor.org/rfc/rfc7230#section-5.3> for the excruciating
   * details.
   *
   * For example, for the requested URL
   * `https://example.com:123/foo/bar?baz=10`, this would be `/foo/bar?baz=10`.
   * This property name corresponds to the standard Node field `request.url`,
   * even though it's not actually a URL per se. We chose to diverge from Node
   * for the sake of clarity.
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
   * Gets a request header, by name, returning `null` if there was no such
   * header.
   *
   * @param {string} name The header name.
   * @returns {?string|Array<string>} The corresponding value, or `null` if
   *   there was no such header. The only case where an array is returned is for
   *   the very special name `set-coookie`.
   */
  getHeaderElseNull(name) {
    return (name === 'set-cookie')
      ? this.headers.getSetCookie()
      : this.headers.get(name);
  }

  /**
   * Indicates whether the method of this request is either `get` or `head`.
   * This is a common enough (dual) case that it's worth it to have this
   * convenience method.
   *
   * @returns {boolean} `true` iff the request method is either `get` or `head`.
   */
  isGetOrHead() {
    const method = this.#requestMethod;
    return (method === 'get') || (method === 'head');
  }

  /**
   * @returns {object} {@link #parsedTargetObject}, filling it out first if it
   * had not already been set up. This is a private getter because the return
   * value is pretty ad-hoc, and we don't want to expose it as part of this
   * class's API.
   */
  get #parsedTarget() {
    if (this.#parsedTargetObject.type === null) {
      const { targetString } = this.#parsedTargetObject;
      this.#parsedTargetObject = Object.freeze(
        IncomingRequest.#calcParsedTargetObject(targetString));
    }

    return this.#parsedTargetObject;
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
   * @param {TypeNodeRequest} request Request object.
   * @param {RequestContext} context Information about the request not
   *   represented in `request`.
   * @param {?object} [options] Miscellaneous options.
   * @param {?IntfLogger} [options.logger] Logger to use as a base, or `null`
   *   not to do any logging. If passed as non-`null`, the actual logger
   *   instance will be one that includes an additional subtag representing a
   *   new unique-ish ID for the request.
   * @param {?number} [options.maxRequestBodyBytes] Maximum size allowed for a
   *   request body, in bytes, or `null` not to have a limit. Note that not
   *   having a limit is often ill-advised. If non-`null`, must be a
   *   non-negative integer.
   * @returns {IncomingRequest} Instance with data based on a low-level Node
   *   request (etc.).
   */
  static async fromNodeRequest(request, context, options = null) {
    // Note: It's impractical to do more thorough type checking here (and
    // probably not worth it anyway).
    MustBe.object(request);

    const {
      logger              = null,
      maxRequestBodyBytes = null
    } = options ?? {};

    const { pseudoHeaders, headers } = IncomingRequest.#extractHeadersFrom(request);
    const requestMethod = IncomingRequest.#requestMethodFromPseudoHeaders(pseudoHeaders);

    let body;
    if (HttpUtil.requestBodyIsExpectedFor(requestMethod)) {
      body = await IncomingRequest.#readBody(
        request,
        HttpUtil.numberFromContentLengthString(headers.get('content-length')),
        maxRequestBodyBytes);
    } else {
      body = await IncomingRequest.#readEmptyBody(request);
    }

    return new IncomingRequest({
      body,
      context,
      headers,
      logger,
      protocolName: `http-${request.httpVersion}`,
      pseudoHeaders
    });
  }

  /**
   * Calculates the value for {@link #parsedTargetObject}, given an original
   * target string. The return value is _not_ frozen.
   *
   * @param {string} targetString The original target string.
   * @returns {object} Value to store into {@link #parsedTargetObject}.
   */
  static #calcParsedTargetObject(targetString) {
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
      // freezing `parts` lets `new PathKey()` avoid making a copy.
      const pathParts = Object.freeze(pathnameString.slice(1).split('/'));

      return {
        targetString,
        type:           'origin',
        pathname:       new PathKey(pathParts, false),
        pathnameString,
        searchString:   urlObj.search
      };
    } else if (targetString === '*') {
      // This is the `asterisk-form` as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.4>.
      return {
        targetString,
        type: 'asterisk'
      };
    } else if (/^[a-zA-Z][-+.0-9a-zA-Z]+:[/][/]/.test(targetString)) {
      // This is the `absolute-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.2>. The regex we
      // use is actually somewhat more restrictive than the spec seems to allow
      // (specifically, we require `://`), but in practice it's almost certainly
      // pointless (and arguably a bad idea) to accept anything looser. Note
      // that without our restriction (or similar), there is ambiguity between
      // this form and the `authority-form`.
      return {
        targetString,
        type: 'absolute'
      };
    } else if (/^[-~_.%:@!$&'()*+,;=0-9a-zA-Z]+$/.test(targetString)) {
      // This is the `authority-form`, as defined by
      // <https://www.rfc-editor.org/rfc/rfc7230#section-5.3.3>. We are somewhat
      // _looser_ here than the spec requires, but because (as of this writing)
      // we aren't trying to do anything serious with this form, we aren't going
      // to spend a lot of (brain or CPU) cycles worrying about it. Also, as of
      // this writing, it seems that Node rejects this form entirely, so maybe
      // this is all moot.
      return {
        targetString,
        type: 'authority'
      };
    } else {
      // Node is supposed to reject anything invalid before we get here, but
      // just in case, it's arguably better to just tag it here rather than
      // report an error. (Famous last words?)
      return {
        targetString,
        type: 'other'
      };
    }
  }

  /**
   * Gets the canonicalized (downcased, as this project prefers) version of the
   * given request method. This method accepts both all-caps and lowercase
   * versions of the method names, but not mixed case.
   *
   * @param {string} method The request method.
   * @returns {string} The canonicalized version.
   * @throws {Error} Thrown if `method` was an invalid value.
   */
  static #canonicalizeRequestMethod(method) {
    // The following is expected to be faster than a call to `toLowerCase()` and
    // a lookup in a `Set` of valid values.
    switch (method) {
      case 'connect': case 'delete': case 'get':  case 'head':
      case 'options': case 'patch':  case 'post': case 'put':
      case 'trace': {
        return method;
      }
      case 'CONNECT': { return 'connect'; }
      case 'DELETE':  { return 'delete';  }
      case 'GET':     { return 'get';     }
      case 'HEAD':    { return 'head';    }
      case 'OPTIONS': { return 'options'; }
      case 'PATCH':   { return 'patch';   }
      case 'POST':    { return 'post';    }
      case 'PUT':     { return 'put';     }
      case 'TRACE':   { return 'trace';   }
    }

    throw new Error(`Invalid request method: ${method}`);
  }

  /**
   * Extracts the two sets of headers from a low-level request object.
   *
   * @param {TypeNodeRequest} request Request object.
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

        if (key === 'method') {
          // Convert the method to our preferred lowercase form here. This will
          // also reject invalid methods.
          pseudoHeaders.set('method', IncomingRequest.#canonicalizeRequestMethod(s));
        } else {
          pseudoHeaders.set(key, s);
        }
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
            // HTTP1-ish requests, this becomes the synthesized `:authority`
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

    // Fill in the other pseudo-headers when given an HTTP1-ish request.
    if (!modernHttp) {
      pseudoHeaders.set('method', request.method);
      pseudoHeaders.set('path',   request.url);
      // Note: No way to determine `:scheme` for these requests.
    }

    Object.freeze(headers);
    Object.freeze(pseudoHeaders);
    return { headers, pseudoHeaders };
  }

  /**
   * Reads the request body of the given Node request.
   *
   * @param {TypeNodeRequest} request Request object.
   * @param {?number} contentLength The extracted `content-length` header value,
   *   or `null` if it was absent or unparseable.
   * @param {?number} maxRequestBodyBytes Maxiumum allowed size of the body, in
   *   bytes, or `null` for no limit.
   * @returns {Buffer} The fully-read body.
   */
  static async #readBody(request, contentLength, maxRequestBodyBytes) {
    const max = (maxRequestBodyBytes === null)
      ? Number.POSITIVE_INFINITY
      : maxRequestBodyBytes;

    const tooLarge = () => {
      return new Error(
        `Request body is larger than allowed maximum of ${maxRequestBodyBytes} bytes.`);
    };

    if ((contentLength !== null) && (contentLength > max)) {
      // There is a valid `content-length` header, and it indicates a size over
      // the limit. Reject the request now, before bothering to read it.
      throw tooLarge();
    }

    if (contentLength === null) {
      // No up-front `content-length`, so just gather buffers until we get
      // everything or run into a size issue.
      const chunks = [];
      let   length = 0;

      for await (const chunk of request) {
        chunks.push(chunk);
        length += chunk.length;
        if (length > max) {
          throw tooLarge();
        }
      }

      return Buffer.concat(chunks, length);
    } else {
      const result = Buffer.alloc(contentLength);
      let   at     = 0;

      for await (const chunk of request) {
        const length = chunk.length;
        if ((at + length) > max) {
          throw tooLarge();
        }
        result.set(chunk, at);
        at += length;
      }

      return result;
    }
  }

  /**
   * Checks that the given Node request has no body (content), by attempting to
   * read it. Throws an error if there was any data to be read.
   *
   * @param {TypeNodeRequest} request Request object.
   * @returns {null} `null`, always (unless there is an error).
   */
  static async #readEmptyBody(request) {
    for await (const chunk of request) {
      if (chunk.length !== 0) {
        throw new Error('Expected empty request body, but there was data.');
      }
    }

    return null;
  }

  /**
   * Gets the downcased request method from a set of HTTP2-ish pseudo-headers.
   * This method accepts both all-uppercase and all-lowercase versions of the
   * method names, but not mixed case.
   *
   * @param {HttpHeaders} pseudoHeaders The pseudo-headers.
   * @returns {string} The request method from `pseudoHeaders`.
   * @throws {Error} Thrown if there was no such header, or it was an
   *   inappropriate value.
   */
  static #requestMethodFromPseudoHeaders(pseudoHeaders) {
    const rawResult = pseudoHeaders.get('method');

    if (!rawResult) {
      throw new Error('No `method` pseudo-header found.');
    }

    return IncomingRequest.#canonicalizeRequestMethod(rawResult);
  }
}
