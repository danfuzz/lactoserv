// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of certificatey stuff.
 */
export class Certificates {
  /**
   * @returns {string} Regex pattern for a standard-form PEM certificate file.
   * It is surrounded by `^...$` so as to only match complete strings.
   */
  static get CERTIFICATE_PATTERN() {
    return this.#makePemPattern('CERTIFICATE');
  }

  /**
   * @returns {string} Regex pattern for a standard-form PEM private key file.
   * It is surrounded by `^...$` so as to only match complete strings.
   */
  static get PRIVATE_KEY_PATTERN() {
    return this.#makePemPattern('PRIVATE KEY');
  }

  /**
   * Checks that a given value is a string matching {@link CERTIFICATE_PATTERN}.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkCertificate(value) {
    return MustBe.string(value, this.CERTIFICATE_PATTERN);
  }

  /**
   * Checks that a given value is a string matching {@link PRIVATE_KEY_PATTERN}.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkPrivateKey(value) {
    return MustBe.string(value, this.PRIVATE_KEY_PATTERN);
  }

  /**
   * Makes a PEM-matching pattern.
   *
   * @param {string} label The label to match.
   * @returns {string} The constructed pattern.
   */
  static #makePemPattern(label) {
    const base64Line = '[/+a-zA-Z0-9]{1,80}';
    const body       = `(${base64Line}\n+){0,500}${base64Line}={0,2}\n+`

    return '^\n*'
      + `-----BEGIN ${label}-----\n+`
      + body
      + `-----END ${label}-----\n+`
      + '$';
  }
}
