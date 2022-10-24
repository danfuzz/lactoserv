// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of names, including type names.
 */
export class Names {
  /**
   * @returns {string} Regex pattern which matches a general name-of-something
   * in this system, anchored so that it matches a complete string. These are
   * used to name application instances, server instances, etc.
   *
   * This pattern allows non-empty strings consisting of alphanumerics plus `-`,
   * which furthermore must start and end with an alphanumeric character.
   */
  static get NAME_PATTERN() {
    return '^(?!-)[-a-zA-Z0-9]+(?<!-)$'
  }

  /**
   * @returns {string} Regex pattern which matches a general type-of-something
   * in this system, anchored so that it matches a complete string. These are
   * used to name application types, service types, etc.
   *
   * **Note:** This is the same as {@link #NAME_PATTERN}, the field name just
   * being to help signal intent at the use site.
   */
  static get TYPE_PATTERN() {
    return this.NAME_PATTERN;
  }
}
