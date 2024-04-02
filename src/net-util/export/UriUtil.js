// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { MustBe } from '@this/typey';


/**
 * Utilities for dealing with URIs and components thereof, including parsing
 * methods.
 */
export class UriUtil {
  /**
   * Checks that a given value is a string which can be interpreted as an
   * absolute URI path (no protocol, host, etc.). It must:
   *
   * * Start with a slash (`/`).
   * * End with a slash (`/`).
   * * Not contain double (or more) slashes.
   * * Not contain `.` or `..` path components.
   * * Not contain a query or hash fragment.
   * * Not contain characters that need `%`-encoding. (It is expected to be
   *   pre-encoded.)
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkAbsolutePath(value) {
    // Basic constraints.
    const pattern =
      '^' +
      '(?=[/])' +              // Must start with a slash.
      '(?!.*[/][.]{0,2}[/])' + // No empty, `.`, or `..` components.
      '.*/$';                  // Must end with a slash.

    MustBe.string(value, pattern);

    // Check the rest of the constraints by parsing and only accepting it if
    // a successfully-parsed path is the same as the given one.
    try {
      const url = new URL(`http://x${value}`);
      if (url.pathname === value) {
        return value;
      }
    } catch {
      // Fall through to throw the error.
    }

    throw new Error('Must be an absolute URI path.');
  }

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
  static checkBasicUri(value) {
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
   * Checks that a given value is a string representing a protocol name (as
   * allowed by this system).
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkProtocol(value) {
    const pattern = /^(http|https|http2)$/;
    return MustBe.string(value, pattern);
  }

  /**
   * Gets the string form of a {@link TreePathKey} as a URI path, that is, the
   * part of a URI after the hostname. The result is in absolute form by default
   * (prefixed with `/`), or is optionally in relative form (prefixed with
   * `./`). Empty components are represented as one might expect, with no
   * characters between two slashes for an empty component in the middle of a
   * path or with a trailing slash for an empty component at the end of the
   * path.
   *
   * @param {TreePathKey} key The key to convert.
   * @param {boolean} [relative] Make the result relative (with `./` as the
   *   prefix).
   * @returns {string} The string form.
   */
  static pathStringFrom(key, relative = false) {
    MustBe.instanceOf(key, TreePathKey);

    return key.toString({
      prefix:         relative ? '.' : '/',
      separatePrefix: relative,
      separator:      '/',
      suffix:         ''
    });
  }
}
