// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MustBe } from '@this/typey';


/**
 * Utilities for dealing with URIs and components thereof, including parsing
 * methods.
 */
export class UriUtil {
  /**
   * Checks that a given value is a string which can be interpreted as a "basic"
   * absolute URI. It must:
   *
   * * Be a valid URI in general.
   * * Specify either `http` or `https` protocol.
   * * End with a slash (`/`).
   * * Not contain double (or more) slashes.
   * * Not contain `.` or `..` path components.
   * * Not contain a query or hash fragment.
   * * Not contain characters that need `%`-encoding. (It is expected to be
   *   pre-encoded.)
   * * Not contain a username or password.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static mustBeBasicUri(value) {
    // Basic constraints.
    const pattern =
      '^' +
      '(http|https):' +        // Only `http` or `https` protocol.
      '[/][/](?![/])' +        // Exactly two slashes after the colon.
      '(?!.*[/][.]{0,2}[/])' + // No empty, `.`, or `..` components.
      '.*/$';                  // Must end with a slash.

    MustBe.string(value, pattern);

    // Check the rest of the constraints by parsing as a URL and investigating
    // the result.
    try {
      const url = new URL(value);
      if (   (url.username === '') && (url.password === '')
          && value.endsWith(url.pathname)) {
        return value;
      }
    } catch {
      // Fall through to throw the error.
    }

    throw new Error('Must be a basic absolute URI.');
  }

  /**
   * Checks if a given string is syntactically valid as a received URI path
   * component (thing between slashes or at the end of a path before queries,
   * etc.), per RFC 3986. The caveat "received" is that `.` and `..` are
   * supposed to get "resolved away" before being sent to a server.
   *
   * @param {*} component Alleged path component.
   * @returns {boolean} `true` if `component` is actually syntactically valid.
   */
  static isPathComponent(component) {
    MustBe.string(component);

    if ((component === '.') || (component === '..')) {
      return false;
    }

    // Allow ASCII alphanumerics, plus any of `-_.~!$&'()*+,;=:@%`.
    if (!/^[-_.~!$&'()*+,;=:@%A-Za-z0-9]*$/.test(component)) {
      return false;
    }

    // If there are any `%`s, they must be valid percent-encoded sequences.
    if (/%/.test(component)) {
      for (const [match] of component.matchAll(/%.{0,2}/g)) {
        if (!/^%[0-9A-F]{2}$/.test(match)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Gets the string form of a {@link PathKey} as a URI path, that is, the part
   * of a URI after the hostname. The result is in absolute form by default
   * (prefixed with `/`), or is optionally in relative form (prefixed with
   * `./`). Empty components are represented as one might expect, with no
   * characters between two slashes for an empty component in the middle of a
   * path or with a trailing slash for an empty component at the end of the
   * path.
   *
   * @param {PathKey} key The key to convert.
   * @param {boolean} [relative] Make the result relative (with `./` as the
   *   prefix).
   * @returns {string} The string form.
   */
  static pathStringFrom(key, relative = false) {
    MustBe.instanceOf(key, PathKey);

    return key.toString({
      prefix:         relative ? '.' : '/',
      separatePrefix: relative,
      separator:      '/',
      suffix:         ''
    });
  }
}
