// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import fs from 'node:fs/promises';

import { Duration } from '@this/data-values';
import { StatsBase } from '@this/fs-util';
import { MustBe } from '@this/typey';


/**
 * Utility class for various HTTP stuff.
 */
export class HttpUtil {
  /**
   * @type {Map<string, string>} Mapping from arbitrarily-cased header names to
   * their modern (downcased) versions. Seeded proactively and then lazily
   * accumulated.
   */
  static #ANY_TO_MODERN = new Map();

  /**
   * @type {Map<string, string>} Mapping from arbitrarily-cased header names to
   * their classic version (mostly capitalized though with some exceptions).
   * Seeded proactively and then lazily accumulated.
   */
  static #ANY_TO_CLASSIC = new Map();

  /**
   * @type {Map<string, { name: string, type: string|Function, format:
   * ?Function }>} Map from each valid cache control option to its in-header
   * name and value formatter / validator.
   */
  static #CACHE_CONTROL_OPTIONS = new Map(Object.entries({
    immutable:            { name: 'immutable',              format: this.#ccBoolean },
    maxAge:               { name: 'max-age',                format: this.#ccSeconds },
    mustRevalidate:       { name: 'must-revalidate',        format: this.#ccBoolean },
    mustUnderstand:       { name: 'must-understand',        format: this.#ccBoolean },
    noCache:              { name: 'no-cache',               format: this.#ccBoolean },
    noStore:              { name: 'no-store',               format: this.#ccBoolean },
    noTransform:          { name: 'no-transform',           format: this.#ccBoolean },
    public:               { name: 'public',                 format: this.#ccBoolean },
    private:              { name: 'private',                format: this.#ccBoolean },
    proxyRevalidate:      { name: 'proxy-revalidate',       format: this.#ccBoolean },
    sMaxAge:              { name: 's-max-age',              format: this.#ccSeconds },
    staleIfError:         { name: 'stale-if-error',         format: this.#ccSeconds },
    staleWhileRevalidate: { name: 'stale-while-revalidate', format: this.#ccSeconds }
  }));

  static {
    const add = (classic) => {
      const modern = classic.toLowerCase();
      this.#ANY_TO_MODERN.set(classic, modern);
      this.#ANY_TO_MODERN.set(modern, modern);
      this.#ANY_TO_CLASSIC.set(modern, classic);
      this.#ANY_TO_CLASSIC.set(classic, classic);
    };

    add('Accept-Ranges');
    add('Cache-Control');
    add('Connection');
    add('Content-Length');
    add('Content-Range');
    add('Content-Type');
    add('Cookie');
    add('Date');
    add('ETag');
    add('Keep-Alive');
    add('Last-Modified');
    add('Location');
    add('Server');
    add('Set-Cookie');
  }

  /**
   * Constructs a `cache-control` header value, based on options with names and
   * values that are friendly to this project.
   *
   * The following configuration options are accepted, and generally correspond
   * to the same-named (except kabob-cased) items in a `cache-control` value.
   *
   * * `{boolean} immutable` -- Specify `immutable`.
   * * `{Duration|string} maxAge` -- `max-age` value (seconds granularity).
   * * `{boolean} mustRevalidate` -- Specify `must-revalidate`.
   * * `{boolean} mustUnderstand` -- Specify `must-understand`.
   * * `{boolean} noCache` -- Specify `no-cache`.
   * * `{boolean} noStore` -- Specify `no-store`.
   * * `{boolean} noTransform` -- Specify `no-transform`.
   * * `{boolean} public` -- Specify `private`.
   * * `{boolean} private` -- Specify `private`.
   * * `{boolean} proxyRevalidate` -- Specify `proxy-revalidate`.
   * * `{Duration|string} sMaxAge` -- `s-max-age` value (seconds granularity).
   * * `{Duration|string} staleIfError` -- `stale-if-error` value (seconds
   *   granularity).
   * * `{Duration|string} staleWhileRevalidate` -- `stale-while-revalidate`
   *   value (seconds granularity).
   *
   * For the options that take a `{Duration|string}`, the string is expected to
   * be a duration value parsable via {@link Duration#parse} (see which for
   * details on the syntax), e.g., `123 sec`.
   *
   * @param {?object} options Cache control options, or `null` to not use this
   *   mechanism for adding cache-control headers.
   * @returns {string} The corresponding header value.
   */
  static cacheControlHeader(options) {
    const parts = [];

    for (const [k, v] of Object.entries(options)) {
      const info = this.#CACHE_CONTROL_OPTIONS.get(k);
      if (!info) {
        throw new Error(`Unknown cache control option: ${k}`);
      }

      const { name, format } = info;
      const formatted        = format(name, v);

      if (typeof formatted === 'string') {
        parts.push(formatted);
      } else {
        throw new Error(`Invalid value for cache control option \`${k}\`: ${formatted.error}`);
      }
    }

    if (parts.length === 0) {
      throw new Error('Must specify at least one option.');
    }

    return parts.join(', ');
  }

  /**
   * Given a header name in any casing, return the classic casing. Classic
   * casing is _mostly_ capitalized at dashes, but `ETag` is a notable
   * exception.
   *
   * **Note:** This implementation does not know about all the exceptions. If
   * there is an exception which, in practice, is common enough to worry about,
   * this class can (and should) be updated. That said, because headers are
   * case-ignored, missing cases are not expected to cause actual problems
   * (beyond mild developer annoyance).
   *
   * @param {string} orig The original header name.
   * @returns {string} The modern casing for same.
   */
  static classicHeaderNameFrom(orig) {
    const already = this.#ANY_TO_CLASSIC.get(orig);

    if (already) {
      return already;
    }

    // If it's an exception, it will be in the `ANY_TO_CLASSIC` table, mapped
    // from the modern version. So we check that first before manually
    // transforming the string.
    const modern   = this.modernHeaderNameFrom(orig);
    const already2 = this.#ANY_TO_CLASSIC.get(modern);

    if (already2) {
      return already2;
    }

    const chars = [...modern];

    for (let i = 0; i < chars.length; i++) {
      if ((i === 0) || (chars[i - 1] === '-')) {
        chars[i] = chars[i].toUpperCase();
      }
    }

    const result = chars.join('');

    this.#ANY_TO_CLASSIC.set(orig, result);

    return result;
  }

  /**
   * Produces a date-time string in the standard HTTP format, given a
   * millisecond Epoch time.
   *
   * @param {number|bigint} atMsec The millisecond Epoch time.
   * @returns {string} The corresponding HTTP-format date-time string.
   */
  static dateStringFromMsec(atMsec) {
    atMsec = (typeof atMsec === 'bigint')
      ? Number(atMsec)
      : MustBe.number(atMsec, { finite: true });

    return new Date(atMsec).toUTCString();
  }

  /**
   * Produces a date-time string in the standard HTTP format, for the
   * modification time of a given {@link fs.Stats} or {@link fs.BigIntStats}
   * object.
   *
   * @param {fs.Stats|fs.BigIntStats} stats The file stats.
   * @returns {string} The corresponding HTTP-format date-time string.
   */
  static dateStringFromStatsMtime(stats) {
    MustBe.instanceOf(stats, StatsBase);
    return stats.mtime.toUTCString();
  }

  /**
   * Given a header name in any casing, return the canonical modern casing,
   * which is to say fully downcased.
   *
   * @param {string} orig The original header name.
   * @returns {string} The modern casing for same.
   */
  static modernHeaderNameFrom(orig) {
    const already = this.#ANY_TO_MODERN.get(orig);

    if (already) {
      return already;
    } else {
      const result = orig.toLowerCase();
      this.#ANY_TO_MODERN.set(orig, result);
      return result;
    }
  }

  /**
   * Parses an (alleged) HTTP date string. Returns a millisecond Epoch time if
   * successfully parsed.
   *
   * @param {?string} dateString An (alleged) HTTP date string.
   * @returns {?number} A millisecond time, or `null` if not parseable.
   */
  static msecFromDateString(dateString) {
    if (dateString === null) {
      return null;
    }

    MustBe.string(dateString);

    // Note: Technically, HTTP date strings are all supposed to be GMT and have
    // one of three very specific format, but we mostly just let `Date.parse()`
    // blithely accept anything it wants, which _does_ accept the required
    // formats in addition to who-knows-what-else.

    let result;

    if (/ (GMT|UTC)$/.test(dateString)) {
      result = Date.parse(dateString);
    } else {
      // It doesn't have the expected suffix, so tack one on, and hope for the
      // best.
      result = Date.parse(`${dateString} UTC`);
    }

    return isNaN(result) ? null : result;
  }

  /**
   * Given an HTTP(ish) response request method and status code, indicates if
   * the corresponding response _is allowed to_ include a body.
   *
   * @param {string} method Request method, either downcased or all-caps.
   * @param {number} status Status code.
   * @returns {boolean} `true` if a body is possibly allowed, or `false` if it
   *   definitely is not allowed.
   */
  static responseBodyIsAllowedFor(method, status) {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if ((method === 'head') || (method === 'HEAD')) {
      return (status >= 400);
    } else {
      if (status <= 199) {
        return false;
      }

      switch (status) {
        case 204: case 205:
        case 304: {
          return false;
        }
      }

      return true;
    }
  }

  /**
   * Given an HTTP(ish) response status code, indicates if the corresponding
   * response body (or lack thereof) is expected to be high-level application
   * content.
   *
   * @param {number} status Status code.
   * @returns {boolean} `true` if the body is for high-level application
   *   content.
   */
  static responseBodyIsApplicationContentFor(status) {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if ((status >= 200) && (status <= 299)) {
      return true;
    }

    switch (status) {
      case 300: case 304: {
        return true;
      }
    }

    return false;
  }

  /**
   * Given an HTTP(ish) response request method and status code, indicates if
   * the corresponding response _is required to_ include a body.
   *
   * @param {string} method Request method, either downcased or all-caps.
   * @param {number} status Status code.
   * @returns {boolean} `true` if a body is required, or `false` if not.
   */
  static responseBodyIsRequiredFor(method, status) {
    // This is all based on a reading of the "Status Codes" section of RFC9110.

    if ((method === 'head') || (method === 'HEAD')) {
      return false;
    } else {
      switch (status) {
        case 200: case 206: {
          return true;
        }
      }

      return false;
    }
  }

  /**
   * Given an HTTP(ish) response request method and status code, indicates if
   * the response is allowed to be cached.
   *
   * @param {string} method Request method, either downcased or all-caps.
   * @param {number} status Status code.
   * @returns {boolean} `true` if a response is cacheable, or `false` if not.
   */
  static responseIsCacheableFor(method, status) {
    // This is all based on a reading of the "Method Definitions" and "Status
    // Codes" sections of RFC9110.

    switch (method) {
      case 'get':  case 'GET':
      case 'head': case 'HEAD': {
        // These might be cacheable.
        break;
      }
      case 'post': case 'POST': {
        // `POST` is only cacheable if its response could be `GET`-able. We
        // conservatively return `false` here.
        return false;
      }
      default: {
        // Nothing else is cacheable.
        return false;
      }
    }

    switch (status) {
      case 200: case 203: case 204: case 206:
      case 300: case 301: case 304: case 308:
      case 404: case 405: case 410: case 414:
      case 501: {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper for {@link #cacheControl}, which validates and formats a boolean.
   *
   * @param {string} name The in-header name.
   * @param {*} value The value.
   * @returns {string} The formatted form.
   */
  static #ccBoolean(name, value) {
    if (typeof value === 'boolean') {
      return value ? name : null;
    } else {
      return { error: 'Expected type `boolean`.' };
    }
  }

  /**
   * Helper for {@link #cacheControl}, which validates a duration and extracts a
   * whole number of seconds.
   *
   * @param {string} name The in-header name.
   * @param {*} duration The duration.
   * @returns {string} The formatted form.
   */
  static #ccSeconds(name, duration) {
    try {
      duration = Duration.parse(duration, { minInclusive: 0 });
    } catch {
      if (typeof duration === 'string') {
        return { error: 'Expected non-negative duration string.' };
      } else if (duration instanceof Duration) {
        return { error: 'Expected non-negative duration.' };
      } else {
        return { error: 'Expected type `string` or `Duration`.' };
      }
    }

    return `${name}=${Math.floor(duration.sec)}`;
  }
}
