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
    MustBe.instanceOf(responseHeaders, HttpHeaders);
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
      const responseEtag = responseHeaders.get('etag');

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

      if (isNaN(modifiedSince)) {
        return false;
      }

      const lastModified = stats?.mtime.getTime()
        ?? HttpUtil.msecFromDateString(responseHeaders.get('last-modified') ?? null);

      if (!lastModified || isNaN(lastModified)) {
        return false;
      }

      if (lastModified > modifiedSince) {
        return false;
      }
    }

    return true;
  }
}
