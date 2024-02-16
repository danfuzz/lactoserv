// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import rangeParser from 'range-parser';

import { StatsBase } from '@this/fs-util';
import { MustBe } from '@this/typey';

import { HttpConditional } from '#x/HttpConditional';
import { HttpHeaders } from '#x/HttpHeaders';


/**
 * Utility class for HTTP range handling.
 */
export class HttpRange {
  /** @type {string} The range unit which is recognized. */
  static #UNIT = 'bytes';

  /**
   * Given an original response body-or-length and pending response headers,
   * parses range-related request headers, if any, and and returns sufficient
   * info for making the ultimate response.
   *
   * @param {string} requestMethod The request method (e.g., `get`), in either
   *   lowercase or all-caps.
   * @param {HttpHeaders|object} requestHeaders Request headers which possibly
   *   indicate a range request. The headers that matter in this regard are
   *   `range` and `if-range`.
   * @param {?HttpHeaders} responseHeaders Would-be response headers for a
   *   content-bearing response, or `null` to _just_ use `stats`. The headers
   *   that matter in this regard are `content-length`, `etag`, and
   *   `last-modified`.
   * @param {?StatsBase|bigint|number} [statsOrLength] File stats from which to
   *   derive a last-modified date and file size, just the file size as a
   *   number, or `null` if none of that is directly available. If non-`null`,
   *   this takes precedence over header values.
   * @returns {?object} Range-related info, or `null` if the request is not one
   *   which can be answered with a range result.
   */
  static rangeInfo(requestMethod, requestHeaders, responseHeaders, statsOrLength = null) {
    MustBe.string(requestMethod);
    // MustBe.instanceOf(requestHeaders, HttpHeaders); TODO: Make it true.
    if (responseHeaders !== null) {
      MustBe.instanceOf(responseHeaders, HttpHeaders);
    }

    const { range } = requestHeaders;

    if (!range) {
      // Not a range request.
      return null;
    }

    let stats;
    let bodyLength;
    if (statsOrLength === null) {
      stats      = null;
      bodyLength = null;
    } else if (statsOrLength instanceof StatsBase) {
      stats      = statsOrLength;
      bodyLength = Number(stats.size);
    } else if (typeof stats === 'number') {
      stats      = null;
      bodyLength = statsOrLength;
    } else if (typeof stats === 'bigint') {
      stats      = null;
      bodyLength = Number(statsOrLength);
    } else {
      throw new Error('`statsOrLength` must be `null`, a `StatsBase`, or a number.');
    }

    if (!HttpConditional.isRangeApplicable(requestMethod, requestHeaders, responseHeaders, stats)) {
      // There was a range condition which didn't match.
      return null;
    }

    if (bodyLength === null) {
      const blHeader = responseHeaders.get('content-length');
      if (!blHeader) {
        throw new Error('No content length passed (either via headers or explicitly).');
      }
      bodyLength = parseInt(blHeader, 10);
      if (isNaN(bodyLength)) {
        throw new Error('Could not parse `content-length` header.');
      }
    }

    // Note: The package `range-parser` is pretty lenient about the syntax it
    // accepts. TODO: Replace with something stricter.
    const ranges = rangeParser(bodyLength, range, { combine: true });
    if ((ranges === -1) || (ranges === -2) || (ranges.type !== this.#UNIT)) {
      // Couldn't parse at all, not satisfiable, or wrong unit.
      return {
        error:   true,
        status:  416,
        headers: { 'content-range': `${this.#UNIT} */${bodyLength}` }
      };
    }

    if (ranges.length !== 1) {
      // We don't deal with non-overlapping ranges.
      return null;
    }

    const { start, end } = ranges[0];

    return {
      headers: {
        'accept-ranges': this.#UNIT,
        'content-range': `${this.#UNIT} ${start}-${end}/${bodyLength}`
      },
      status:       206,     // "Partial Content."
      start,
      end:          end + 1, // Exclusive, as a normal for JavaScript.
      endInclusive: end,     // `range` headers are end-inclusive.
      length:       end - start + 1
    };
  }

  /**
   * Sets on the given headers the response headers indicating that a range
   * request would have been acceptable.
   *
   * @param {HttpHeaders} headers The headers to add to.
   */
  static setBasicResponseHeaders(headers) {
    headers.set('accept-ranges', this.#UNIT);
  }
}
