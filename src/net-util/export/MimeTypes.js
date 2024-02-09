// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import mime from 'mime';

import { MustBe } from '@this/typey';


/**
 * Utilities for wrangling MIME types / content types.
 *
 * **Note:** This is mostly just a wrapper around an external package, mainly to
 * keep the dependency details from "infecting" the rest of the system.
 */
export class MimeTypes {
  /**
   * Gets the MIME type for the given extension (no dot or just initial dot in
   * the given string) or extension of the given file path (dot in the middle of
   * the string). This returns `'application/octet-stream'` if nothing better
   * can be determined.
   *
   * @param {string} extensionOrPath File extension or path.
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
  static typeFromExtension(extensionOrPath, options = {}) {
    MustBe.string(extensionOrPath);
    const { charSet = null, isText = false } = MustBe.object(options);

    const mimeType = mime.getType(extensionOrPath)
      ?? (isText ? 'text/plain' : 'application/octet-stream');

    return (charSet && (isText || /^text[/]/.test(mimeType)))
      ? `${mimeType}; charset=${charSet}`
      : mimeType;
  }

  /**
   * Returns the given string if it is a known MIME type, or acts like {@link
   * #typeFromExtension} if it looks like a simple extension value (string
   * consisting of a dot followed by one to ten characters, not including any
   * other dots or slashes). If it is an extension that is unrecognized, this
   * returns `'application/octet-stream'`. This throws an an error in all other
   * cases.
   *
   * @param {string} extensionOrType File extension or MIME type.
   * @returns {string} The MIME type.
   */
  static typeFromExtensionOrType(extensionOrType) {
    MustBe.string(extensionOrType);

    if (/^\.[^./]{1,10}$/.test(extensionOrType)) {
      const found = mime.getType(extensionOrType);
      return found ?? 'application/octet-stream';
    } else if (/^(?=.*[/])[a-zA-Z][-_.=/; a-zA-Z0-9]+$/.test(extensionOrType)) {
      const found = mime.getExtension(extensionOrType);
      if (!found) {
        throw new Error(`Unknown MIME type: ${extensionOrType}`);
      }
      return extensionOrType;
    } else {
      throw new Error(`Invalid syntax for MIME type or file extension: ${extensionOrType}`);
    }
  }
}
