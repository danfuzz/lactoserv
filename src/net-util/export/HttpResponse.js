// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';
import http from 'node:http';

import { ManualPromise } from '@this/async';
import { Paths, StatsBase } from '@this/fs-util';
import { MustBe } from '@this/typey';

import { HttpHeaders } from '#x/HttpHeaders';
import { HttpUtil } from '#x/HttpUtil';

/**
 * Responder to an HTTP request. This class holds all the information needed to
 * perform a response, along with the functionality to produce it.
 */
export class HttpResponse {
  /** @type {?string} The original request method, or `null` if not yet set. */
  #requestMethod = null;

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
   * @returns {string} The original HTTP(ish) request's "method" (e.g. `get`
   * or `post`).
   */
  get requestMethod() {
    return this.#requestMethod;
  }

  /**
   * @param {string} value The original request method.
   */
  set requestMethod(value) {
    this.#requestMethod = MustBe.string(value, /^[a-z]{1,15}$/);
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
   * Sets the response body to be based on a file. If the response length (e.g.
   * the `length` if specified) is small enough, the response body is read from
   * the file during this call.
   *
   * @param {string} absolutePath Absolute path to the file.
   * @param {?object} [options] Options.
   * @param {?StatsBase} [options.stats] Stats for the file, if known. If not
   *   known, then they are retrieved during this call.
   * @param {?number} [options.offset] Offset in bytes from the start of `body`
   *   of what to actually send. Defaults to `0` (that is, the start).
   * @param {?number} [options.length] How many bytes to actually send, or
   *   `null` to indicate the maximum amount possible. Defaults to `null`.
   */
  async setBodyFile(absolutePath, options = null) {
    Paths.checkAbsolutePath(absolutePath);
    const { offset = null, length = null, stats: maybeStats = null } = options ?? {};

    const stats = await HttpResponse.#adjustStats(maybeStats, absolutePath);

    const fileLength  = stats.size;
    const finalOffset = HttpResponse.#adjustByteIndex(offset ?? 0, fileLength);
    const finalLength = HttpResponse.#adjustByteIndex(length, fileLength - finalOffset);

    if (finalLength <= HttpResponse.#MAX_IMMEDIATE_READ_SIZE) {
      const buffer =
        await HttpResponse.#readFilePortion(absolutePath, finalOffset, finalLength);

      this.#body = { type: 'buffer', buffer };
    } else {
      this.#body = {
        type:   'file',
        path:   absolutePath,
        offset: finalOffset,
        length: finalLength,
      };
    }
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
   * * Checking that {@link #requestMethod} is set.
   * * Checking that {@link #status} is set.
   * * Checking that one of the body-setup methods has been called (that is, one
   *   of {@link #setBodyBuffer}, {@link #setBodyFile}, or {@link #setNoBody}).
   *
   * And, depending on the body:
   *
   * * If `body !== null`:
   *   * Checking that request method was not `HEAD` if the the status is
   *     successful (`2xx`).
   *   * Checking that `status` allows a body.
   *   * Checking that a `content-type` header is present.
   *   * Checking that a `content-length` header is _not_ present (because this
   *     class will generate it).
   * * If `body === null`:
   *   * Checking that no content-related headers are present.
   *
   * To be clear, this is far from an exhaustive list of possible error checks.
   * It is meant to catch the most common and blatant client problems.
   */
  validate() {
    const { headers, requestMethod, status } = this;
    const body = this.#body;

    if (requestMethod === null) {
      throw new Error('`.requestMethod` not set.');
    } else if (status === null) {
      throw new Error('`.status` not set.');
    } else if (body === null) {
      throw new Error('Body (or lack thereof) not defined.');
    }

    if (body.type === 'none') {
      if (HttpUtil.responseBodyIsRequiredFor(requestMethod, status)) {
        throw new Error(`Non-body response is incompatible with method \`${requestMethod}\` and status ${status}.`);
      }

      for (const h of HttpResponse.#CONTENT_HEADERS) {
        if (headers.get(h)) {
          throw new Error(`Non-body response cannot use header \`${h}\`.`);
        }
      }
    } else {
      if (!HttpUtil.responseBodyIsAllowedFor(requestMethod, status)) {
        throw new Error(`Body-bearing response is incompatible with method \`${requestMethod}\` and status ${status}.`);
      } else if (headers.get('content-length')) {
        throw new Error('Body-bearing response must not have `content-length` header pre-set.');
      } else if (!headers.get('content-type')) {
        throw new Error('Body-bearing response must have `content-type` header pre-set.');
      }
    }
  }

  /**
   * Sends this instance as a response to the request linked to the given core
   * {@link http.HttpResponse} object (or similar).
   *
   * @param {http.HttpResponse} res The response object to invoke.
   * @returns {boolean} `true` when the response is completed.
   */
  async writeTo(res) {
    this.validate();

    const { headers, status } = this;
    const body = this.#body;

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

    switch (body.type) {
      case 'buffer': {
        return await this.#writeBodyBuffer(res);
      }
      case 'file':  {
        return await this.#writeBodyFile(res);
      }
      case 'none': {
        return await this.#writeNoBody(res);
      }
      default: {
        // If we get here, it indicates a bug in this class.
        throw new Error(`Shouldn't happen: Weird body type: ${body.type}.`);
      }
    }
  }

  /**
   * Writes the body from a buffer, and ends the response.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyBuffer(res) {
    const buffer = this.#body.buffer;

    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);

    return HttpResponse.#whenResponseDone(res);
  }

  /**
   * Writes the body from a file, and ends the response.
   *
   * @param {http.HttpResponse} res The response object to use.
   * @returns {boolean} `true` when closed without error.
   * @throws {Error} Any error reported by `res`.
   */
  async #writeBodyFile(res) {
    const CHUNK_SIZE = HttpResponse.#READ_CHUNK_SIZE;
    const { path, offset, length } = this.#body;

    res.setHeader('Content-Length', length);

    if (length <= CHUNK_SIZE) {
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
   * @type {number} Maximum size of a response body to immediately read from a
   * file and keep in an instance.
   */
  static #MAX_IMMEDIATE_READ_SIZE = 16 * 1024; // 16k

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
