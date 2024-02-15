// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StatsBase } from '@this/fs-util';
import { MustBe } from '@this/typey';

import { HttpHeaders } from '#x/HttpHeaders';
import { HttpUtil } from '#x/HttpUtil';


/**
 * Utility class for various HTTP conditional tests.
 */
export class HttpConditional {
  /**
   * @type {RegExp} Regex which matches a `cache-control` header that specifies
   * `no-cache` somewhere in it.
   */
  static #NO_CACHE_REGEX = /(?:^|,) *no-cache *(?:,|$)/;

  /**
   * Checks to see if a response with the given headers would be considered
   * "fresh" such that a not-modified (status `304`) response could be issued to
   * either a `GET` or `HEAD` request.
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
   * @param {string} requestMethod The request method (e.g., `get`), in either
   *   lowercase or all-caps.
   * @param {HttpHeaders|object} requestHeaders Request headers which possibly
   *   contain content conditionals. The headers that matter in this regard are
   *   `cache-control`, `if-none-match`, and `if-modified-since`.
   * @param {?HttpHeaders} responseHeaders Would-be response headers for a
   *   content-bearing response, or `null` to _just_ use `stats`. The headers
   *   that matter in this regard are `etag` and `last-modified`.
   * @param {?StatsBase} [stats] File stats from which to derive a last-modified
   *   date, or `null` if no stats are available. If non-`null`, this takes
   *   precedence over a header value.
   * @returns {boolean} `true` iff the request is to be considered "fresh."
   */
  static isContentFresh(requestMethod, requestHeaders, responseHeaders, stats = null) {
    MustBe.string(requestMethod);
    // MustBe.instanceOf(requestHeaders, HttpHeaders); TODO: Make it true.
    if (responseHeaders !== null) {
      MustBe.instanceOf(responseHeaders, HttpHeaders);
    }
    if (stats !== null) {
      MustBe.instanceOf(stats, StatsBase);
    }

    switch (requestMethod) {
      case 'get': case 'head':
      case 'GET': case 'HEAD': {
        // Possibly fresh.
        break;
      }
      default: {
        return false;
      }
    }

    const cacheControl = HttpHeaders.get(requestHeaders, 'cache-control');

    if (cacheControl && this.#NO_CACHE_REGEX.test(cacheControl)) {
      return false;
    }

    const ifNoneMatch = HttpHeaders.get(requestHeaders, 'if-none-match');

    if (ifNoneMatch) {
      const responseEtag = responseHeaders?.get('etag') ?? null;

      if (!responseEtag || (responseEtag === '')) {
        return false;
      }

      const tagsToMatch = ifNoneMatch.split(/^ *| *, */);

      if (tagsToMatch.indexOf(responseEtag) < 0) {
        return false;
      }

      // We don't check `if-modified-since` at this point, because we have a
      // matching etag, and per spec a matching etag takes precedence over any
      // date checks.
      return true;
    }

    const ifModifiedSince = HttpHeaders.get(requestHeaders, 'if-modified-since');

    if (ifModifiedSince) {
      const modifiedSince = HttpUtil.msecFromDateString(ifModifiedSince);

      if (!modifiedSince) {
        return false;
      }

      const lastModified = this.#msecTimeFrom(responseHeaders, stats);

      if (!lastModified) {
        return false;
      }

      if (lastModified > modifiedSince) {
        return false;
      }

      return true;
    }

    // It turned out not to be a conditional request, which makes it
    // definitionally "not fresh."
    return false;
  }

  /**
   * Checks to see if a range request would be applicable in light of any
   * conditional range request headers. This returns `true` if it is valid to
   * send a `206` ("Partial Content") response.
   *
   * A range request is considered to be applicable if:
   * * The request method is `HEAD` or `GET`.
   * * One of:
   *   * The request does not have a range condition at all.
   *   * The request has an `if-range` header with a matching etag.
   *   * The request has an `if-range` header with a sufficiently-late date.
   *     This form is akin to the `if-unmodified-since` header for non-range
   *     requests.
   *
   * This assumes that the response would have a sans-check status code that is
   * acceptable for conversion to status `206` ("Partial Content").
   *
   * @param {string} requestMethod The request method (e.g., `get`), in either
   *   lowercase or all-caps.
   * @param {HttpHeaders|object} requestHeaders Request headers which possibly
   *   contain range conditionals. The header that matters in this regard is
   *   `if-range`.
   * @param {?HttpHeaders} responseHeaders Would-be response headers for a
   *   content-bearing response, or `null` to _just_ use `stats`. The headers
   *   that matter in this regard are `etag` and `last-modified`.
   * @param {?StatsBase} [stats] File stats from which to derive a last-modified
   *   date, or `null` if no stats are available. If non-`null`, this takes
   *   precedence over a header value.
   * @returns {boolean} `true` iff the request is to be considered "fresh."
   */
  static isRangeApplicable(requestMethod, requestHeaders, responseHeaders, stats = null) {
    MustBe.string(requestMethod);
    // MustBe.instanceOf(requestHeaders, HttpHeaders); TODO: Make it true.
    if (responseHeaders !== null) {
      MustBe.instanceOf(responseHeaders, HttpHeaders);
    }
    if (stats !== null) {
      MustBe.instanceOf(stats, StatsBase);
    }

    switch (requestMethod) {
      case 'get': case 'head':
      case 'GET': case 'HEAD': {
        // Possibly applicable.
        break;
      }
      default: {
        return false;
      }
    }

    const ifRange = HttpHeaders.get(requestHeaders, 'if-range');

    if (!ifRange) {
      // This isn't a conditional range request, so it is de facto applicable.
      return true;
    }

    if (ifRange.startsWith('"')) {
      // It's an etag condition. Note: It is invalid per spec to use a weak etag
      // (form `W/"..."`) in this case, so we don't recognize them in the `if`
      // above.
      const responseEtag = responseHeaders?.get('etag') ?? null;

      if (!responseEtag || (responseEtag === '')) {
        return false;
      }

      return (ifRange === responseEtag);
    } else {
      // Try to parse it as a date.
      const ifUnmodifiedSince = HttpUtil.msecFromDateString(ifRange);

      if (!ifUnmodifiedSince) {
        return false;
      }

      const lastModified = this.#msecTimeFrom(responseHeaders, stats);

      if (!lastModified) {
        return false;
      }

      return (lastModified <= ifUnmodifiedSince);
    }
  }

  /**
   * Gets a seconds-precision modification time from a stats or from a
   * `last-modified` header, with stats taking priority (because it's more
   * efficient, and it should be overwhelmingly more common to end up here with
   * one of those).
   *
   * When dealing with a stats value, the time is produced by truncating off
   * milliseconds. (This is done because the precision of timestamp headers is
   * only to the second, and we want to compare one of those to the timestamp
   * header that _would have been produced_ when converting a stats value.)
   *
   * @param {?HttpHeaders} responseHeaders Would-be response headers, if
   *   available.
   * @param {?StatsBase} stats File stats, if available.
   * @returns {?number} A millisecond Epoch time, if one was found, or `null` if
   *   not.
   */
  static #msecTimeFrom(responseHeaders, stats) {
    if (stats) {
      return Math.trunc(Number(stats.mtimeMs) / 1000) * 1000;
    } else if (responseHeaders) {
      const lastModified = responseHeaders.get('last-modified');
      return HttpUtil.msecFromDateString(lastModified);
    } else {
      return null;
    }
  }
}
