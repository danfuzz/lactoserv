// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import { Duplex } from 'node:stream';

import statuses from 'statuses';

import { ManualPromise } from '@this/async';
import { Paths, StatsBase } from '@this/fs-util';
import { Moment } from '@this/quant';
import { MustBe } from '@this/typey';
import { ErrorUtil } from '@this/valvis';

import { BaseResponse } from '#x/BaseResponse';
import { HttpConditional } from '#x/HttpConditional';
import { HttpHeaders } from '#x/HttpHeaders';
import { HttpRange } from '#x/HttpRange';
import { HttpUtil } from '#x/HttpUtil';
import { MimeTypes } from '#x/MimeTypes';
import { TypeNodeResponse } from '#x/TypeNodeResponse';


/**
 * Complete response to an HTTP request, with the ability to actually send it to
 * a network client via low-level Node response object. This class is mostly in
 * the "mechanism not policy" camp, except that (a) it _does_ enforce
 * consistency / unambiguity of use, and (b) it refuses to send responses that
 * are (reasonably believed to be) contrary to the HTTP (etc.) specification.
 *
 * **Note:** This class is designed so that clients can ignore the special
 * response behavior required by the `HEAD` request method. Specifically, even
 * if the method is `HEAD`, this class expects clients to set a body when the
 * result status calls for it, and this class takes care of (a) calculating
 * `content-length` when appropriate, (b) _not_ wasting any effort on building
 * up a response body that won't get sent, and (c) _not_ actually sending a
 * response body.
 */
export class FullResponse extends BaseResponse {
  /**
   * The response status code, or `null` if not yet set.
   *
   * @type {?number}
   */
  #status = null;

  /**
   * The response headers, or `null` if not yet set.
   *
   * @type {?HttpHeaders}
   */
  #headers = null;

  /**
   * Information about the body, or `null` if not yet set.
   *
   * @type {?object}
   */
  #body = null;

  /**
   * `cache-control` header to automatically use when appropriate, or `null` not
   * to do that.
   *
   * @type {?string}
   */
  #cacheControl = null;

  /**
   * Constructs an instance.
   *
   * @param {FullResponse} [orig] Original instance to copy, or `null` to start
   *   the instance out with nothing set.
   */
  constructor(orig = null) {
    super();

    if (orig) {
      MustBe.instanceOf(orig, FullResponse);
      this.#status       = orig.#status;
      this.#headers      = orig.#headers ? new HttpHeaders(orig.headers) : null;
      this.#cacheControl = orig.#cacheControl;
      this.#body         = orig.#body;
    }
  }

  /**
   * @returns {?Buffer} Buffer containing all response data, or `null` if this
   * instance never had immediate data set. Specifically, this is only
   * non-`null` after either {@link #setBodyBuffer} or {@link #setBodyString}
   * has been called (and not overwritten by another body-setting call).
   *
   * **Note:** The returned buffer is a fresh copy, so that the innards of this
   * instance don't get exposed. As such, it shouldn't be used in
   * performance-sensitive code, nor should its result be kept gc-alive for very
   * long.
   */
  get bodyBuffer() {
    const { type, buffer } = this.#body;

    return (type === 'buffer') ? Buffer.from(buffer) : null;
  }

  /**
   * @returns {?string} The automatic `cache-control` header value, or `null` if
   * not configured to do that.
   */
  get cacheControl() {
    return this.#cacheControl;
  }

  /**
   * A `cache-control` header to include in any response whose status code
   * indicates that a response is possibly cacheable, using a request method
   * that also allows for caching, or `null` not to do automatic `cache-control`
   * header insertion. (See {@link HttpUtil#responseIsCacheableFor}.) If this is
   * non-`null`, then it is an error to include `cache-control` in
   * {@link #headers}.
   *
   * @type {?string}
   */
  set cacheControl(value) {
    if (value !== null) {
      MustBe.string(value, /./);
    }

    this.#cacheControl = value;
  }

  /**
   * @returns {HttpHeaders} The headers to be sent with this response. The
   * return value is shared with the internal state of this instance.
   */
  get headers() {
    if (this.#headers === null) {
      this.#headers = new HttpHeaders();
    }

    return this.#headers;
  }

  /**
   * @param {HttpHeaders} headers The headers to set. This object becomes shared
   * with the internal state of this instance.
   */
  set headers(headers) {
    this.#headers = MustBe.instanceOf(headers, HttpHeaders);
  }

  /**
   * @returns {?number} The HTTP-ish response status code, or `null` if not yet
   * set.
   */
  get status() {
    return this.#status;
  }

  /**
   * @param {number} value The HTTP-ish response status code.
   */
  set status(value) {
    this.#status =
      MustBe.number(value, { safeInteger: true, minInclusive: 100, maxInclusive: 599 });
  }

  /**
   * Adjusts the state of this response, based on the nature of the given
   * request. Returns a new instance with adjustments as necessary, or returns
   * this instance if no adjustments were required. Options -- all `boolean` --
   * indicate which adjustments to make, and include:
   *
   * * `conditional` -- Handle the conditional "freshness" headers
   *   `if-none-match` and `if-modified-since`.
   * * `range` -- Handle range-related headers `range` and `if-range`.
   *
   * This method always returns `this` if `status` is set to something other
   * than `200` ("OK") or `204` ("No Content").
   *
   * @param {string} requestMethod The original request method.
   * @param {HttpHeaders} requestHeaders The request headers.
   * @param {object} options Options indicating which adjustments to make.
   * @returns {FullResponse} New response instance containing adjustments, or
   *   `this` if no adjustments were required.
   */
  adjustFor(requestMethod, requestHeaders, options) {
    const { headers, status } = this;

    if ((status !== 200) && (status !== 204)) {
      if (status === null) {
        throw new Error('Cannot adjust until `status` is set.');
      }
      return this;
    }

    if (this.#body === null) {
      throw new Error('Cannot adjust until body is set.');
    }

    const { conditional, range: origRange } = options;
    const range = origRange && (status === 200); // Can't do a range on a `204`.

    if (conditional) {
      const { type, stats } = this.#body;

      let isFresh;
      if (type === 'file') {
        isFresh = HttpConditional.isContentFresh(requestMethod, requestHeaders, headers, stats);
      } else {
        isFresh = HttpConditional.isContentFresh(requestMethod, requestHeaders, headers);
      }

      if (isFresh) {
        const result = new FullResponse(this);
        if (range) {
          HttpRange.setBasicResponseHeaders(result.headers);
        }
        result.headers.deleteContent();
        result.status = 304; // "Not Modified."
        result.setNoBody();

        return result;
      }
    }

    if (range) {
      const { type, buffer, stats } = this.#body;

      let rangeInfo;
      if (type === 'buffer') {
        rangeInfo = HttpRange.rangeInfo(requestMethod, requestHeaders, headers, buffer.length);
      } else if (type === 'file') {
        rangeInfo = HttpRange.rangeInfo(requestMethod, requestHeaders, headers, stats);
      } else {
        rangeInfo = null;
      }

      if (!rangeInfo) {
        const result = new FullResponse(this);
        HttpRange.setBasicResponseHeaders(result.headers);
        return result;
      } else if (rangeInfo.error) {
        // Note: We _don't_ use the for-success `headers` here.
        const result = new FullResponse();
        // TODO: Fix the following line when `rangeInfo` is switched to
        // returning an actual `HttpHeaders` object.
        result.headers = new HttpHeaders(rangeInfo.headers);
        result.status  = rangeInfo.status;
        result.setBodyMessage();
        return result;
      } else {
        const result = new FullResponse(this);
        result.headers.setAll(rangeInfo.headers);
        result.status = rangeInfo.status;
        result.sliceBody(rangeInfo.start, rangeInfo.end);
        return result;
      }
    }

    return this;
  }

  /**
   * Gets all reasonably-logged info about a lower-level response object that is
   * (presumed to be) completed (written, sent, and ended). In case of an error
   * in the response, this method aims to report the error-ish info via a normal
   * return (not by `throw`ing).
   *
   * **Note:** The `headers` in the result omits anything that is redundant with
   * respect to other parts of the return value. (E.g., the `content-length`
   * header is always omitted, and the `:status` pseudo-header is omitted from
   * HTTP2 response headers.)
   *
   * @param {TypeNodeResponse} res The response object.
   * @param {Duplex} connectionSocket The underlying socket for the connection.
   * @returns {object} Loggable information about the response.
   */
  getInfoForLog(res, connectionSocket) {
    const statusCode    = res.statusCode;
    const headers       = res.getHeaders();
    const contentLength = this.#shouldSendBody(res)
      ? (headers['content-length'] ?? null)
      : null;

    return {
      ...ErrorUtil.collateErrors({
        connection:     connectionSocket?.errored,
        request:        res.req?.errored,
        requestSocket:  res.req?.socket?.errored,
        response:       res.errored,
        responseSocket: res[FullResponse.#RESPONSE_SOCKET_SYMBOL]?.errored
      }),
      statusCode,
      contentLength,
      headers: FullResponse.#sanitizeResponseHeaders(headers)
    };
  }

  /**
   * Sets the response body to be based on a buffer.
   *
   * @param {Buffer} body The full body.
   * @param {?object} [options] Options.
   * @param {?number} [options.offset] Offset in bytes from the start of `body`
   *   of what to actually send. Defaults to `0` (that is, the start).
   * @param {?number} [options.length] How many bytes to actually send, or
   *   `null` to indicate the maximum amount possible. Defaults to `null`.
   */
  setBodyBuffer(body, options = null) {
    MustBe.instanceOf(body, Buffer);
    const { offset = null, length = null } = options ?? {};

    const finalOffset = FullResponse.#adjustByteIndex(offset ?? 0, body.length);
    const finalLength = FullResponse.#adjustByteIndex(length, body.length - finalOffset);
    const buffer = (finalLength === body.length)
      ? body
      : body.subarray(finalOffset, finalOffset + finalLength);

    this.#body = Object.freeze({ type: 'buffer', buffer });
  }

  /**
   * Sets the response body to be based on a file.
   *
   * Unless directed not to (by an option), this method will cause a
   * `last-modified` header to be added to the response, based on the stats of
   * the given file.
   *
   * @param {string} absolutePath Absolute path to the file.
   * @param {?object} [options] Options.
   * @param {?StatsBase} [options.stats] Stats for the file, if known. If not
   *   known, then they are retrieved during this call.
   * @param {?number} [options.offset] Offset in bytes from the start of `body`
   *   of what to actually send. Defaults to `0` (that is, the start).
   * @param {?number} [options.length] How many bytes to actually send, or
   *   `null` to indicate the maximum amount possible. Defaults to `null`.
   * @param {?boolean} [options.lastModified] Whether to send a `last-modified`
   *   header based on the file's stats. Defaults to `true`.
   */
  async setBodyFile(absolutePath, options = null) {
    Paths.mustBeAbsolutePath(absolutePath);
    const {
      offset = null,
      length = null,
      lastModified = true,
      stats: maybeStats = null
    } = options ?? {};

    const stats = await FullResponse.#adjustStats(maybeStats, absolutePath);
    const lmMoment = lastModified
      ? { lastModified: Moment.fromMsec(Number(stats.mtimeMs)) }
      : null;

    const fileLength  = stats.size;
    const finalOffset = FullResponse.#adjustByteIndex(offset ?? 0, fileLength);
    const finalLength = FullResponse.#adjustByteIndex(length, fileLength - finalOffset);

    this.#body = Object.freeze({
      type:   'file',
      path:   absolutePath,
      offset: finalOffset,
      length: finalLength,
      stats,
      ...lmMoment
    });
  }

  /**
   * Sets the response body to be a diagnostic message of some sort. This is
   * meant to be used for non-content responses (anything other than status
   * `2xx` and _some_ `3xx`). If no `options` are given, a simple default
   * message is produced based on the status code (once set). In all cases, the
   * response body is sent as content type `text/plain` with encoding `utf-8`.
   *
   * @param {?object} [options] Options to control the response body.
   * @param {?string} [options.body] Complete body content to include.
   * @param {?string} [options.bodyExtra] Extra body content to include, in
   *   addition to the default body. At most one of this or `options.body` may
   *   be passed, but not both.
   */
  setBodyMessage(options = null) {
    const { body = null, bodyExtra = null } = options ?? {};

    if (body !== null) {
      if (bodyExtra !== null) {
        throw new Error('Cannot specify both `body` and `bodyExtra`.');
      }
      this.#body = { type: 'message', message: MustBe.string(body) };
    } else if (bodyExtra !== null) {
      this.#body = { type: 'message', messageExtra: MustBe.string(bodyExtra) };
    } else {
      this.#body = { type: 'message' };
    }

    Object.freeze(this.#body);
  }

  /**
   * Sets the response body to be based on a string. The MIME content type must
   * be specified. If the content type includes a `charset`, it must be valid
   * and usable by Node to encode the string. If the content type _does not_
   * include a `charset`, then `utf-8` will be used (which will also be reported
   * on the ultimate response).
   *
   * When this method is used, the headers of this instance must not _also_ have
   * a `content-type`.
   *
   * @param {string} body The full body.
   * @param {string} contentType The MIME content type, or file extension to
   *   derive it from (see {@link MimeTypes#typeFromExtensionOrType}).
   */
  setBodyString(body, contentType) {
    MustBe.string(body);
    if (typeof contentType !== 'string') {
      throw new Error('Missing `contentType` argument.');
    }

    contentType = MimeTypes.typeFromExtensionOrType(contentType, { isText: true });

    const charSet = MimeTypes.charSetFromType(contentType);

    if (charSet === 'utf8') {
      // This is the one incorrect value that Node accepts and which we also
      // really care about complaining about. (This project prefers enforcing
      // caller consistency over creeping DWIM-isms.)
      throw new Error('The IETF says that the UTF-8 encoding is called `utf-8`.');
    }

    const buffer = Buffer.from(body, charSet);

    this.#body = Object.freeze({ type: 'buffer', buffer, contentType });
  }

  /**
   * Indicates unambiguously that this instance is to have no response body.
   */
  setNoBody() {
    this.#body = Object.freeze({ type: 'none' });
  }

  /**
   * "Slices" the body, in the style of `Buffer.slice()`. This is only valid
   * when the body is set to regular content, that is, by {@link #setBodyBuffer}
   * or {@link #setBodyString}.
   *
   * @param {number} start Start index, inclusive.
   * @param {number} endExclusive End index, exclusive.
   */
  sliceBody(start, endExclusive) {
    MustBe.number(start, { safeInteger: true, minInclusive: 0 });
    MustBe.number(endExclusive, { safeInteger: true, minInclusive: start });

    const body = this.#body;

    if (!body) {
      throw new Error('Cannot slice until body is set.');
    }

    const { type, buffer, offset, length } = body;

    switch (type) {
      case 'buffer': {
        MustBe.number(start, { maxInclusive: buffer.length });
        MustBe.number(endExclusive, { maxInclusive: buffer.length });
        this.#body = Object.freeze({
          ...body,
          buffer: buffer.subarray(start, endExclusive)
        });
        break;
      }
      case 'file': {
        MustBe.number(start, { maxInclusive: length });
        MustBe.number(endExclusive, { maxInclusive: length });
        this.#body = Object.freeze({
          ...body,
          offset: offset + start,
          length: endExclusive - start
        });
        break;
      }
      default: {
        throw new Error('Cannot slice unless body is set to known data.');
      }
    }
  }

  /**
   * Validates this instance for completeness and correctness. This includes:
   *
   * * Checking that {@link #status} is set.
   * * Checking that one of the body-setup methods has been called (that is, one
   *   of `setBody*()` or {@link #setNoBody}).
   *
   * And, depending on the body:
   *
   * * If there is no body:
   *   * Checking that no content-related headers are present. One exception:
   *     Status `416` ("Range Not Satisfiable") allows `content-range`.
   * * If there is a content body:
   *   * Checking that `status` allows a body.
   *   * Checking that a `content-type` header is present _or_
   *     {@link #setBodyString} was used (which includes an explicit
   *     `contentType` argument).
   *   * Checking that a `content-length` header is _not_ present (because this
   *     class will generate it).
   * * If there is a "message" (meta-information) body:
   *   * Checking that `status` doesn't imply application content.
   *   * Checking that `status` _does_ allow a body.
   *   * Checking that no content-related headers are present. (They are
   *     generated automatically.)
   *
   * To be clear, this is far from an exhaustive list of possible error checks.
   * It is meant to catch the most common and blatant client problems.
   */
  validate() {
    const { cacheControl, headers, status } = this;
    const body                              = this.#body;

    if (status === null) {
      throw new Error('`.status` not set.');
    } else if (body === null) {
      throw new Error('Body (or lack thereof) not defined.');
    }

    if (cacheControl && headers.get('cache-control')) {
      throw new Error('Must not use automatic `cacheControl` with `cache-control` header pre-set.');
    }

    // Why `get` as the method for the tests below? Because this class wants all
    // data-bearing statuses to actually have data, even if it turns out to be
    // a `head` request. See the header comment for details.

    switch (body.type) {
      case 'none': {
        if (HttpUtil.responseBodyIsRequiredFor('get', status)) {
          throw new Error(`Non-body response is incompatible with status ${status}.`);
        }

        const headerExceptions = FullResponse.#CONTENT_HEADER_EXCEPTIONS[status];

        for (const h of FullResponse.#CONTENT_HEADERS) {
          if (!headerExceptions?.has(h) && headers.get(h)) {
            throw new Error(`Non-body response cannot use header \`${h}\`.`);
          }
        }

        break;
      }

      case 'buffer':
      case 'file': {
        if (!HttpUtil.responseBodyIsAllowedFor('get', status)) {
          throw new Error(`Body-bearing response is incompatible with status ${status}.`);
        }

        const contentType = body.contentType;

        if (contentType) {
          if (headers.get('content-type')) {
            throw new Error('Must not use specified `contentType` with `content-type` header pre-set.');
          }
        } else if (!headers.get('content-type')) {
          throw new Error('Body-bearing response must have `content-type` header pre-set.');
        }

        if (headers.get('content-length')) {
          throw new Error('Body-bearing response must not have `content-length` header pre-set.');
        }

        if (body.lastModified && headers.get('last-modified')) {
          throw new Error('Must not use automatic `lastModified` with `last-modified` header pre-set.');
        }

        break;
      }

      case 'message': {
        if (HttpUtil.responseBodyIsApplicationContentFor(status)) {
          throw new Error(`Message response is inappropriate with status ${status}.`);
        } else if (!HttpUtil.responseBodyIsAllowedFor('get', status)) {
          throw new Error(`Message response is incompatible with status ${status}.`);
        }

        const headerExceptions = FullResponse.#CONTENT_HEADER_EXCEPTIONS[status];

        for (const h of FullResponse.#CONTENT_HEADERS) {
          if (!headerExceptions?.has(h) && headers.get(h)) {
            throw new Error(`Message response cannot use header \`${h}\`.`);
          }
        }

        break;
      }

      default: {
        // Indicates a bug in this class.
        throw new Error('Shouldn\'t happen.');
      }
    }
  }

  /**
   * Sends this instance as a response to the request linked to the given
   * low-level Node response object.
   *
   * **Note:** This method takes into account if the given response corresponds
   * to a `HEAD` request, in which case it won't bother trying to send any body
   * data for a successful response (status `2xx` or `3xx`), even if this
   * instance has a body set.
   *
   * @param {TypeNodeResponse} res The low-level response object to respond via.
   * @returns {boolean} `true` when the response is completed.
   */
  async writeTo(res) {
    this.validate();

    const { cacheControl, headers, status } = this;
    const { type: bodyType }                = this.#body;
    const requestMethod                     = res.req.method; // Note: This is in all-caps.
    const shouldSendBody                    = this.#shouldSendBody(res);

    res.statusCode = status;
    if (res.req.httpVersionMajor === 1) {
      // Only do this for HTTP1, because HTTP2 doesn't use status messages.
      res.statusMessage = statuses(status);
    }

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

    const entries = headers.entriesForVersion(res.req.httpVersionMajor);
    for (const [name, value] of entries) {
      res.setHeader(name, value);
    }

    if (cacheControl && HttpUtil.responseIsCacheableFor(requestMethod, status)) {
      res.setHeader('Cache-Control', cacheControl);
    }

    // Note: At this point, all headers have been set on `res` _except_
    // `content-length` (which is always set per body type as necessary).

    switch (bodyType) {
      case 'buffer': {
        return await this.#writeBodyBuffer(res, shouldSendBody);
      }
      case 'file':  {
        return await this.#writeBodyFile(res, shouldSendBody);
      }
      case 'message': {
        return await this.#writeBodyMessage(res, shouldSendBody);
      }
      case 'none': {
        return await this.#writeNoBody(res);
      }
      default: {
        // If we get here, it indicates a bug in this class.
        throw new Error(`Shouldn't happen: Weird body type: ${bodyType}.`);
      }
    }
  }

  /**
   * Gets details about the body. **Note:** This method is meant for testing,
   * and the details about what it returns are not considered subject to the API
   * stability rules of this project.
   *
   * @returns {?object} Details about the body that was set, or `null` if no
   *   `setBody*()` method was ever called on this instance. If non-`null` it is
   *   always a frozen plain object.
   */
  _testing_getBody() {
    return this.#body;
  }

  /**
   * Should we send a body in response to the given request? This takes into
   * account the request method and whether the status code allows bodies.
   *
   * @param {TypeNodeResponse} res The low-level response object to check.
   * @returns {boolean} `true` if a body should be sent, or `false` if not.
   */
  #shouldSendBody(res) {
    if (this.#body.bodyType === 'none') {
      return false;
    };

    const { status }    = this;
    const requestMethod = res.req.method; // Note: This is in all-caps.

    return HttpUtil.responseBodyIsAllowedFor(requestMethod, status);
  }

  /**
   * Writes the body from a buffer, and ends the response.
   *
   * @param {TypeNodeResponse} res The low-level response object to write to.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyBuffer(res, shouldSendBody) {
    const { buffer, contentType } = this.#body;

    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }

    res.setHeader('Content-Length', buffer.length);

    if (shouldSendBody) {
      res.end(buffer);
    } else {
      res.end();
    }

    return FullResponse.#whenResponseDone(res);
  }

  /**
   * Writes the body from a file, and ends the response.
   *
   * @param {TypeNodeResponse} res The low-level response object to write to.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyFile(res, shouldSendBody) {
    const CHUNK_SIZE = FullResponse.#READ_CHUNK_SIZE;
    const { path, offset, length, lastModified } = this.#body;

    res.setHeader('Content-Length', length);

    if (lastModified) {
      res.setHeader('Last-Modified', lastModified.toHttpString());
    }

    if (!shouldSendBody) {
      res.end();
      return FullResponse.#whenResponseDone(res);
    }

    if (length <= CHUNK_SIZE) {
      // It's a small enough length that we just send the response with a single
      // `write()`.
      const buffer =
        await FullResponse.#readFilePortion(path, offset, length);
      res.end(buffer);
      return FullResponse.#whenResponseDone(res);
    }

    let handle = null;
    try {
      handle = await fs.open(path);

      let at        = offset;
      let remaining = length;

      while (remaining > 0) {
        // TODO: Consider using a pool for buffers, though probably _don't_ want
        // to use `Buffer.allocUnsafe()` so as to avoid relying on the global
        // `poolSize` being something we'd want.
        const buffer = Buffer.alloc(Math.min(remaining, CHUNK_SIZE));
        const { bytesRead } = await handle.read(buffer, { position: at });

        if (bytesRead === 0) {
          throw new Error(`File changed length during response processing: ${path}`);
        }

        // TODO: Handle `drain` requests (based on return value of `write()`).
        res.write(bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead));

        at += bytesRead;
        remaining -= bytesRead;
      }
    } finally {
      await handle.close();
    }

    res.end();
    return FullResponse.#whenResponseDone(res);
  }

  /**
   * Writes the body for a diagnostic message, and ends the response.
   *
   * @param {TypeNodeResponse} res The low-level response object to write to.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyMessage(res, shouldSendBody) {
    const { message, messageExtra } = this.#body;

    if (!shouldSendBody) {
      // Note: Because message response content isn't ever supposed to get
      // cached, it's okay _not_ to build a body _just_ to figure out its
      // `content-length` header value (and then not send the body). So we don't
      // do that here.
      res.end();
      return FullResponse.#whenResponseDone(res);
    }

    let body;

    if (message) {
      body = message.endsWith('\n')
        ? message
        : `message\n`;
    } else {
      const { status } = this;
      const statusStr  = statuses(status);
      const bodyHeader = `${status} ${statusStr}`;

      if (((messageExtra ?? '') === '') || (messageExtra === statusStr)) {
        body = `${bodyHeader}\n`;
      } else {
        const finalNl = (messageExtra.endsWith('\n')) ? '' : '\n';
        body = `${bodyHeader}:\n\n${messageExtra}${finalNl}`;
      }
    }

    const bodyBuffer = Buffer.from(body, 'utf-8');

    res.setHeader('Content-Type',  'text/plain; charset=utf-8');
    res.setHeader('Content-Length', bodyBuffer.length);
    res.end(bodyBuffer);

    return FullResponse.#whenResponseDone(res);
  }

  /**
   * Ends a response without writing a body.
   *
   * @param {TypeNodeResponse} res The low-level response object to write to.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeNoBody(res) {
    res.end();
    return FullResponse.#whenResponseDone(res);
  }


  //
  // Static members
  //

  /**
   * Array of header names associated with content (that is, non-empty bodies
   * that represent high-level application content).
   *
   * @type {Array<string>}
   */
  static #CONTENT_HEADERS = Object.freeze([
    'content-encoding',
    'content-language',
    'content-length',
    'content-location',
    'content-range',
    'content-security-policy',
    'content-security-policy-report-only',
    'content-type'
  ]);

  /**
   * Excpetions to restrictions of {@link #CONTENT_HEADERS}.
   *
   * @type {...}
   */
  static #CONTENT_HEADER_EXCEPTIONS = Object.freeze({
    416: new Set(['content-range'])
  });

  /**
   * Chunk size to use when reading a file and writing it as a response.
   *
   * @type {number}
   */
  static #READ_CHUNK_SIZE = 64 * 1024; // 64k

  /**
   * Key to use on response objects to hold a result from
   * {@link #whenResponseDone}. See comment at use site for more explanation.
   *
   * @type {symbol}
   */
  static #RESPONSE_DONE_SYMBOL = Symbol('FullResponse.HttpResponseDone');

  /**
   * Key to use on response objects to hold a "secret" copy of its `.socket`.
   * Set by {@link #whenResponseDone}, see comment in which for for more
   * explanation.
   *
   * @type {symbol}
   */
  static #RESPONSE_SOCKET_SYMBOL = Symbol('FullResponse.HttpResponseSocket');

  /**
   * Makes an instance of this class representing a non-content meta-ish
   * response. "Non-content meta-ish" here means that the status code _doesn't_
   * indicate that the body is meant to be higher-level application content,
   * which furthermore means that it is possibly appropriate to use the body for
   * a diagnostic message. And indeed, this method will use it for that when
   * appropriate, that is, when the request method / status combo allows it.
   *
   * @param {number} status The status code to report.
   * @param {?object} [messageOptions] Options to pass to
   *   {@link #setBodyMessage}.
   * @returns {FullResponse} Constructed instance.
   */
  static makeMetaResponse(status, messageOptions = null) {
    const result = new FullResponse();

    result.status = status;

    // Why `get` as the method for the test below? Because we don't yet know
    // the request method, and it's okay to set a message even if the method
    // turns out the be `head`.

    if (HttpUtil.responseBodyIsAllowedFor('get', status)
        && !HttpUtil.responseBodyIsApplicationContentFor(status)) {
      result.setBodyMessage(messageOptions);
    } else {
      result.setNoBody();
    }

    return result;
  }

  /**
   * Makes an instance of this class representing a not-found response (status
   * `404`).
   *
   * @param {?object} [messageOptions] Options to pass to
   *   {@link #setBodyMessage}.
   * @returns {FullResponse} Constructed instance.
   */
  static makeNotFound(messageOptions = null) {
    return this.makeMetaResponse(404, messageOptions);
  }

  /**
   * Makes an instance of this class representing a redirect.
   *
   * **Note:** This method does _not_ do any URL-encoding on the given `target`.
   * It is assumed to be valid and already encoded if necessary.
   *
   * @param {string} target Possibly-relative target URL.
   * @param {?number} [status] The status code to report. Defaults to `302`
   *   ("Found").
   * @returns {FullResponse} Constructed instance.
   */
  static makeRedirect(target, status = 302) {
    const result = this.makeMetaResponse(status, { bodyExtra: target });

    result.headers.set('location', target);

    return result;
  }

  /**
   * Adjusts an incoming index value (e.g. bytes into a buffer or file), per
   * this class's contracts.
   *
   * @param {*} value Value to adjust. Must be either a number or `null`.
   * @param {?number} maxInclusive Maximum allowed value.
   * @returns {?number} Adjusted value, if `value` was valid.
   */
  static #adjustByteIndex(value, maxInclusive) {
    return (value === null)
      ? maxInclusive
      : MustBe.number(value, { safeInteger: true, minInclusive: 0, maxInclusive });
  }

  /**
   * Checks that the given value is a stats object that could possibly be
   * allowed, or is `null`. If `null`, the stats are retrieved.
   *
   * @param {*} value The (alleged) stats value, or `null`.
   * @param {string} path Absolute path of the file.
   * @returns {StatsBase} The given `value` if it is non-`null`, or the freshly
   *   retrieved stats for a non-directory `path`.
   */
  static async #adjustStats(value, path) {
    if (value === null) {
      value = await fs.stat(path);
    } else {
      MustBe.instanceOf(value, StatsBase);
    }

    if (value.isDirectory()) {
      throw new Error(`Cannot use a directory as a response body: ${path}`);
    }

    return value;
  }

  /**
   * Reads a portion of a file, returning a fresh buffer with the contents.
   *
   * @param {string} path Path to the file.
   * @param {number} offset Offset to start reading at.
   * @param {number} length Number of bytes to read.
   * @returns {Buffer} Buffer of the contents of the indicated file portion.
   */
  static async #readFilePortion(path, offset, length) {
    const buffer = Buffer.alloc(length);

    let handle = null;

    try {
      handle = await fs.open(path);
      const result = await handle.read(buffer, { position: offset });
      if (result.bytesRead !== length) {
        throw new Error(`File changed length during response processing: ${path}`);
      }
    } finally {
      await handle.close();
    }

    return buffer;
  }

  /**
   * Cleans up response headers for logging.
   *
   * @param {object} headers Original response headers.
   * @returns {object} Cleaned up version.
   */
  static #sanitizeResponseHeaders(headers) {
    const result = { ...headers };

    // Note: We used to exclude `Content-Length` here, on the theory that it was
    // redundant with the `contentLength` included with the full response log
    // info. However, in the case of a `HEAD` request, it's not actually
    // redundant, because `contentLength` will be `null` while nonetheless there
    // _can_ be a `Content-Length` header.

    delete result[':status'];

    return result;
  }

  /**
   * Returns when an underlying response has been closed successfully (after all
   * of the response is believed to be sent) or has errored. Returns `true` for
   * a normal close, or throws whatever error the response reports.
   *
   * @param {TypeNodeResponse} res The low-level response object to check.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by the underlying response object.
   */
  static async #whenResponseDone(res) {
    // What's happening here: Unfortunately, once a response is finished, the
    // low-level Node library will set the `socket` to `undefined` -- at least
    // in some cases -- and when it does so, there is no other built-in way to
    // see if the response socket got closed due to an error. That leads to a
    // possible loss of useful info once the response is completed... if we
    // don't do anything extra. What we do is stash the socket away in a
    // "secret" property (effectively the "weakmap" pattern), for
    // `getInfoForLog()` to find. And, because we don't want to duplicate all
    // the work of this method, we _also_ stash away our own return value in a
    // similar way.
    const already = res[this.#RESPONSE_DONE_SYMBOL];
    if (already) {
      return already;
    }

    if (res.socket) {
      res[this.#RESPONSE_SOCKET_SYMBOL] = res.socket;
    }

    function makeProperError(error) {
      return (error instanceof Error)
        ? error
        : new Error(`non-error object: ${error}`);
    }

    const resultMp = new ManualPromise();

    if (res.closed || res.destroyed) {
      // Note: It's not correct to also check for `.writableEnded` here (as an
      // earlier version of this code did), because that becomes `true` _before_
      // the outgoing data is believed to have actually made it to the
      // networking stack to be sent out.
      const error = res.errored;
      if (error) {
        resultMp.reject(makeProperError(error));
      } else {
        resultMp.resolve(true);
      }
    } else {
      res.once('error', (error) => {
        if (!resultMp.isSettled()) {
          if (error) {
            resultMp.reject(makeProperError(error));
          } else {
            resultMp.resolve(true);
          }
        } else if (error) {
          // The result promise was already settled, and _then_ an `error` got
          // emitted. This has been observed to happen in production, and
          // ultimately indicates that some class isn't implementing the Node
          // `Stream` API correctly.
          //
          // The actual case that prompted this extra bit of code _might_ be
          // resolved now (at least here), because it was misbehavior of a
          // `TLSSocket` (which we're no longer looking at here). Near as I
          // (@danfuzz) can tell, if the underlying socket gets closed from the
          // other side (`ECONNRESET`), a `TLSSocket` that is using it will end
          // up emitting an `error` with the message `write ECANCELED` _after_
          // it already emitted a `close` event. And `error` after `close` goes
          // against the Node stream spec.
          if (resultMp.isFulfilled()) {
            const value = resultMp.fulfilledValue;
            throw new Error('Response error after promise was already fulfilled. ' +
              `Original value: ${value}. New reason: ${error}`);
          } else {
            const reason = resultMp.rejectedReason;
            throw new Error('Response error after promise was already rejected. ' +
              `Original reason: ${reason}. New reason: ${error}`);
          }
        }
      });

      res.once('close', () => {
        if (!resultMp.isSettled()) {
          resultMp.resolve(true);
        }
      });
    }

    res[this.#RESPONSE_DONE_SYMBOL] = resultMp.promise;
    return resultMp.promise;
  }
}
