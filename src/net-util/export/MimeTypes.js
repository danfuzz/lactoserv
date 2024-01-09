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
   * @returns {string} The MIME type.
   */
  static typeFromExtension(extensionOrPath) {
    MustBe.string(extensionOrPath);

    const result = mime.getType(extensionOrPath);

    return result ?? 'application/octet-stream';
  }

  /**
   * Returns the given string if it is a known MIME type, or acts like {@link
   * #typeFromExtension} if it looks like a simple extension value (string of
   * less than 10 characters with no dot or slash). If it is an extension that
   * is unrecognized, this returns `'application/octet-stream'`. This throws an
   * an error in other cases.
   *
   * @param {string} extensionOrType File extension or MIME type.
   * @returns {string} The MIME type.
   */
  static typeFromExtensionOrType(extensionOrType) {
    MustBe.string(extensionOrType);

    if (/[./]/.test(extensionOrType)) {
      const found = mime.getExtension(extensionOrType);
      if (!found) {
        throw new Error(`Unknown MIME type: ${extensionOrType}`);
      }
      return extensionOrType;
    } else {
      const found = mime.getType(extensionOrType);
      return found ?? 'application/octet-stream';
    }
  }
}
