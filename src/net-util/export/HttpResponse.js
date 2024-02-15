// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import http from 'node:http';

import statuses from 'statuses';

import { ManualPromise } from '@this/async';
import { Paths, StatsBase } from '@this/fs-util';
import { MustBe } from '@this/typey';

import { HttpHeaders } from '#x/HttpHeaders';
import { HttpUtil } from '#x/HttpUtil';
import { MimeTypes } from '#x/MimeTypes';

/**
 * Responder to an HTTP request. This class holds all the information needed to
 * perform a response, along with the functionality to produce it.
 *
 * **Note:** This class is designed so that clients can ignore the special
 * response behavior required by the `HEAD` request method. Specifically, even
 * if the method is `HEAD`, this class expects clients to set a body when the
 * result status calls for it, and this class takes care of (a) calculating
 * `content-length` when appropriate, (b) _not_ wasting any effort on building
 * up a response body that won't get sent, and (c) _not_ actually sending a
 * response body.
 */
export class HttpResponse {
  /** @type {?number} The response status code, or `null` if not yet set. */
  #status = null;

  /** @type {?HttpHeaders} The response headers, or `null` if not yet set. */
  #headers = null;

  /** @type {?object} Information about the body, or `null` if not yet set. */
  #body = null;

  /**
   * Constructs an instance. It is initially empty / unset.
   */
  constructor() {
    // Nothing to do here. (This method exists at all just for the doc comment.)
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
   * @returns {number} The HTTP(ish) response status code.
   */
  get status() {
    return this.#status;
  }

  /**
   * @param {number} value The HTTP(ish) response status code.
   */
  set status(value) {
    this.#status =
      MustBe.number(value, { safeInteger: true, minInclusive: 100, maxInclusive: 599 });
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

    const finalOffset = HttpResponse.#adjustByteIndex(offset ?? 0, body.length);
    const finalLength = HttpResponse.#adjustByteIndex(length, body.length - finalOffset);
    const buffer = (finalLength === body.length)
      ? body
      : body.subarray(finalOffset, finalOffset + finalLength);

    this.#body = { type: 'buffer', buffer };
  }

  /**
   * Sets the response body to be a diagnostic message of some sort. This is
   * meant to be used for non-content responses (anything other than status
   * `2xx` and _some_ `3xx`). If no `options` are given, a simple default
   * message is produced based on the status code. In all cases, the response
   * body is sent as content type `text/plain` with encoding `utf-8`.
   *
   * @param {?object} [options] Options to control the response body.
   * @param {?string|Buffer} [options.body] Complete body content to include.
   * @param {?string} [options.bodyExtra] Extra body content to include, in
   *   addition to the default body. Either this or `options.body` is allowed,
   *   but not both.
   * @param {?string} [options.contentType] Content type of `options.body`.
   *   Required if `options.body` is a `Buffer`. Disallowed in all other cases.
   */
  setBodyMessage(options = null) {
    const { body = null, bodyExtra = null, contentType = null } = options ?? {};

    if (contentType && !(body instanceof Buffer)) {
      throw new Error('Can only specify `contentType` when passing `body` as a `Buffer`.');
    } else if (!contentType && (body instanceof Buffer)) {
      throw new Error('Must specify `contentType` when passing `body` as a `Buffer`.');
    }

    if (body !== null) {
      if (bodyExtra !== null) {
        throw new Error('Cannot specify both `body` and `bodyExtra`.');
      }

      if (body instanceof Buffer) {
        this.#body = { type: 'message', messageBuffer: body, contentType };
      } else {
        this.#body = { type: 'message', message: MustBe.string(body) };
      }
    } else if (bodyExtra !== null) {
      this.#body = { type: 'message', messageExtra: MustBe.string(bodyExtra) };
    }
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
    Paths.checkAbsolutePath(absolutePath);
    const {
      offset = null,
      length = null,
      lastModified = true,
      stats: maybeStats = null
    } = options ?? {};

    const stats = await HttpResponse.#adjustStats(maybeStats, absolutePath);

    const fileLength  = stats.size;
    const finalOffset = HttpResponse.#adjustByteIndex(offset ?? 0, fileLength);
    const finalLength = HttpResponse.#adjustByteIndex(length, fileLength - finalOffset);

    this.#body = {
      type:   'file',
      path:   absolutePath,
      offset: finalOffset,
      length: finalLength,
      lastModified
    };
  }

  /**
   * Sets the response body to be based on a string. The MIME content type must
   * be specified. If the content type includes a `charset`, it must be valid
   * and usable by Node to encode the string. If the content type _does not_
   * include a `charset`, then `utf-8` will be used (which will also be reported
   * on the ultimate response).
   *
   * @param {string} body The full body.
   * @param {string} contentType The MIME content type, or file extension to
   *   derive it from (see {@link MimeTypes#typeFromExtensionOrType}).
   */
  setBodyString(body, contentType) {
    MustBe.string(body);

    contentType =
      MimeTypes.typeFromExtensionOrType(contentType, { charSet: 'utf-8', isText: true });

    const charSet = MimeTypes.charSetFromType(contentType);

    if (charSet === 'utf8') {
      // This is the one incorrect value that Node accepts and which we also
      // really care about complaining about. (This project prefers enforcing
      // caller consistency over creeping DWIM-isms.)
      throw new Error('The IETF says that the UTF-8 encoding is called `utf-8`.');
    }

    const buffer = Buffer.from(body, charSet);

    this.#body = { type: 'buffer', buffer };
  }

  /**
   * Indicates unambiguously that this instance is to have no response body.
   */
  setNoBody() {
    this.#body = { type: 'none' };
  }

  /**
   * Validates this instance for completeness and correctness. This includes:
   *
   * * Checking that {@link #status} is set.
   * * Checking that one of the body-setup methods has been called (that is, one
   *   of {@link #setBodyBuffer}, {@link #setBodyFile}, {@link #setBodyMessage},
   *   or {@link #setNoBody}).
   *
   * And, depending on the body:
   *
   * * If there is no body:
   *   * Checking that no content-related headers are present.
   * * If there is a content body:
   *   * Checking that `status` allows a body.
   *   * Checking that a `content-type` header is present.
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
    const { headers, status } = this;
    const body                = this.#body;

    if (status === null) {
      throw new Error('`.status` not set.');
    } else if (body === null) {
      throw new Error('Body (or lack thereof) not defined.');
    }

    // Why `get` as the method for the tests below? Because this class wants all
    // data-bearing statuses to actually have data, even if it turns out to be
    // a `head` request. See the header comment for details.

    switch (body.type) {
      case 'none': {
        if (HttpUtil.responseBodyIsRequiredFor('get', status)) {
          throw new Error(`Non-body response is incompatible with status ${status}.`);
        }

        for (const h of HttpResponse.#CONTENT_HEADERS) {
          if (headers.get(h)) {
            throw new Error(`Non-body response cannot use header \`${h}\`.`);
          }
        }

        break;
      }

      case 'buffer':
      case 'file': {
        if (!HttpUtil.responseBodyIsAllowedFor('get', status)) {
          throw new Error(`Body-bearing response is incompatible with status ${status}.`);
        } else if (headers.get('content-length')) {
          throw new Error('Body-bearing response must not have `content-length` header pre-set.');
        } else if (!headers.get('content-type')) {
          throw new Error('Body-bearing response must have `content-type` header pre-set.');
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

        for (const h of HttpResponse.#CONTENT_HEADERS) {
          if (headers.get(h)) {
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
   * Sends this instance as a response to the request linked to the given core
   * {@link http.HttpResponse} object (or similar).
   *
   * **Note:** This method takes into account if the given response corresponds
   * to a `HEAD` request, in which case it won't bother trying to send any body
   * data for a successful response (status `2xx` or `3xx`), even if this
   * instance has a body set.
   *
   * @param {http.HttpResponse} res The response object to invoke.
   * @returns {boolean} `true` when the response is completed.
   */
  async writeTo(res) {
    this.validate();

    const { headers, status } = this;
    const { type: bodyType }  = this.#body;
    const requestMethod       = res.method; // Note: This is in all-caps.

    const shouldSendBody = (bodyType !== 'none')
      && HttpUtil.responseBodyIsAllowedFor(requestMethod, status);

    res.status(status);

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
   * Writes the body from a buffer, and ends the response.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyBuffer(res, shouldSendBody) {
    const buffer = this.#body.buffer;

    res.setHeader('Content-Length', buffer.length);

    if (shouldSendBody) {
      res.end(buffer);
    } else {
      res.end();
    }

    return HttpResponse.#whenResponseDone(res);
  }

  /**
   * Writes the body from a file, and ends the response.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyFile(res, shouldSendBody) {
    const CHUNK_SIZE = HttpResponse.#READ_CHUNK_SIZE;
    const { path, offset, length, lastModified } = this.#body;

    res.setHeader('Content-Length', length);

    if (lastModified) {
      const stats = await fs.stat(path, { bigint: true });
      res.setHeader('Last-Modified', HttpUtil.dateStringFromStatsMtime(stats));
    }

    if (!shouldSendBody) {
      res.end();
      return HttpResponse.#whenResponseDone(res);
    }

    if (length <= CHUNK_SIZE) {
      // It's a small enough length that we just send the response with a single
      // `write()`.
      const buffer =
        await HttpResponse.#readFilePortion(path, offset, length);
      res.end(buffer);
      return HttpResponse.#whenResponseDone(res);
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
    return HttpResponse.#whenResponseDone(res);
  }

  /**
   * Writes the body for a diagnostic message, and ends the response.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @param {boolean} shouldSendBody Should the body actually be sent?
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyMessage(res, shouldSendBody) {
    const {
      contentType: bufferContentType,
      message,
      messageBuffer,
      messageExtra
    } = this.#body;

    if (!shouldSendBody) {
      // Note: Because message response content isn't ever supposed to get
      // cached, it's okay _not_ to build a body _just_ to figure out its
      // `content-length` header value (and then not send the body). So we don't
      // do that here.
      res.end();
      return HttpResponse.#whenResponseDone(res);
    }

    let body;
    let bodyBuffer  = null;
    let contentType = 'text/plain; charset=utf-8';

    if (message) {
      body = message.endsWith('\n')
        ? message
        : `message\n`;
    } else if (messageBuffer) {
      bodyBuffer  = messageBuffer;
      contentType = bufferContentType;
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

    bodyBuffer ??= Buffer.from(body, 'utf-8');

    res.setHeader('Content-Type',   contentType);
    res.setHeader('Content-length', bodyBuffer.length);
    res.end(bodyBuffer);

    return HttpResponse.#whenResponseDone(res);
  }

  /**
   * Ends a response without writing a body.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeNoBody(res) {
    res.end();
    return HttpResponse.#whenResponseDone(res);
  }


  //
  // Static members
  //

  /**
   * @type {Array<string>} Array of header names associated with non-empty
   * bodies.
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
   * @type {number} Chunk size to use when reading a file and writing it as a
   * response.
   */
  static #READ_CHUNK_SIZE = 64 * 1024; // 64k

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
      value = await fs.stat(path, { bigint: true });
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
   * Returns when an underlying response has been closed successfully (after
   * all of the response is believed to be sent) or has errored. Returns `true`
   * for a normal close, or throws whatever error the response reports.
   *
   * @param {http.HttpResponse} res The response object in question.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by the underlying response object.
   */
  static async #whenResponseDone(res) {
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
}
