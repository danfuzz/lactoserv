// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import mime from 'mime';

import { Paths } from '@this/fs-util';
import { MustBe } from '@this/typey';


/**
 * Utilities for wrangling MIME types / content types.
 *
 * **Note:** This is mostly just a wrapper around an external package, mainly to
 * keep the dependency details from "infecting" the rest of the system.
 */
export class MimeTypes {
  /**
   * Gets the `charset`, if any, from the given MIME type. This method assumes
   * that the given type is syntactically valid.
   *
   * @param {string} mimeType The MIME type to inspect.
   * @returns {?string} The `charset` value of `type`, or `null` if it does not
   *   have one.
   */
  static charSetFromType(mimeType) {
    MustBe.string(mimeType);

    // RFC2978 says charset names have to be 40 characters or less and also
    // specifies the allowed symbols.
    const found =
      mimeType.match(/; *charset=(?<charSet>[-~_'`!#$%&+^{}A-Za-z0-9]{1,40}) *(?:;|$)/);

    return found?.groups.charSet ?? null;
  }

  /**
   * Gets the MIME type for the filename extension on the given absolute path.
   * This returns `'application/octet-stream'` if nothing better can be
   * determined.
   *
   * @param {string} absolutePath Absolute path to derive a MIME type from.
   * @param {?object} [options] Options.
   * @param {?string} [options.charSet] Character set to return _if_ the
   *   returned type has the prefix `text/` or is otherwise considered to be
   *   text. Defaults to `null`, that is, not to ever include a character set in
   *   the result.
   * @param {?boolean} [options.isText] Indicates that the type is definitely
   *   text. If `true`, `options.charSet` is always used if present, and the
   *   default type if no other type can be ascertained is `text/plain`.
   *   Defaults to `false`.
   * @returns {string} The MIME type.
   */
  static typeFromPathExtension(absolutePath, options = {}) {
    Paths.checkAbsolutePath(absolutePath);
    const { charSet = null, isText = false } = MustBe.object(options);

    return this.#typeFromPathOrExtension(absolutePath, charSet, isText);
  }

  /**
   * Returns the given string if it is a known MIME type, or looks up the type
   * for a file extension if that's what it looks like (specifically, a string
   * consisting of a dot followed by one to ten characters, not including any
   * other dots or slashes). If it is an extension that is unrecognized, this
   * returns `'application/octet-stream'`. This throws an an error in all other
   * cases.
   *
   * @param {string} extensionOrType File extension or MIME type.
   * @param {?object} [options] Options.
   * @param {?string} [options.charSet] Character set to return _if_ the
   *   returned type has the prefix `text/` or is otherwise considered to be
   *   text, and doesn't already come with a character set. Defaults to `null`,
   *   that is, not to ever add a character set when given an extension, nor to
   *   add a character set when given a MIME type without one.
   * @param {?boolean} [options.isText] Indicates that the type is definitely
   *   text. If `true`, `options.charSet` is taken into account if present, and
   *   the default type if no other type can be ascertained is `text/plain`.
   *   Defaults to `false`.
   * @returns {string} The MIME type.
   */
  static typeFromExtensionOrType(extensionOrType, options = {}) {
    MustBe.string(extensionOrType);
    const { charSet = null, isText = false } = MustBe.object(options);

    if (/^\.[^./]{1,10}$/.test(extensionOrType)) {
      return this.#typeFromPathOrExtension(extensionOrType, charSet, isText);
    }

    if (/^(?=.*[/])[a-zA-Z][-_.=/; a-zA-Z0-9]+$/.test(extensionOrType)) {
      const found = mime.getExtension(extensionOrType);
      if (!found) {
        throw new Error(`Unknown MIME type: ${extensionOrType}`);
      }
      return this.#addCharSetIfAppropriate(extensionOrType, charSet, isText);
    }

    throw new Error(`Invalid syntax for MIME type or file extension: ${extensionOrType}`);
  }

  /**
   * Helper method, which does extension-based lookup.
   *
   * @param {string} pathOrExtension String ending with the file extension.
   * @param {?string} charSet `charSet` option as defined by this class's API.
   * @param {?boolean} isText `isText` option as defined by this class's API.
   * @returns {string} The final result.
   */
  static #typeFromPathOrExtension(pathOrExtension, charSet, isText) {
    const mimeType = mime.getType(pathOrExtension)
      ?? (isText ? 'text/plain' : 'application/octet-stream');

    return this.#addCharSetIfAppropriate(mimeType, charSet, isText);
  }

  /**
   * Helper method, which adds a `charset=` section to a MIME type result, when
   * appropriate.
   *
   * @param {string} mimeType The basic MIME type result to possibly alter.
   * @param {?string} charSet `charSet` option as defined by this class's API.
   * @param {?boolean} isText `isText` option as defined by this class's API.
   * @returns {string} The final result.
   */
  static #addCharSetIfAppropriate(mimeType, charSet, isText) {
    if (!charSet || /; *charset=/.test(mimeType)) {
      // No `charSet` to add, or `charset=` already present.
      return mimeType;
    }

    return (isText || /^text[/]/.test(mimeType))
      ? `${mimeType}; charset=${charSet}`
      : mimeType;
  }
}
