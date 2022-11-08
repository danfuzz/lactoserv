// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of certificatey stuff.
 */
export class Certificates {
  /**
   * @returns {string} Regex pattern for a standard-form PEM certificate chain
   * file. It is anchored at both ends by `^...$` so as to only match complete
   * strings.
   */
  static get CERTIFICATE_CHAIN_PATTERN() {
    return this.#makePemPattern('CERTIFICATE', true);
  }

  /**
   * @returns {string} Regex pattern for a standard-form PEM private key file.
   * It is anchored at both ends by `^...$` so as to only match complete
   * strings.
   */
  static get PRIVATE_KEY_PATTERN() {
    return this.#makePemPattern('PRIVATE KEY');
  }

  /**
   * Checks that a given value is a string matching {@link
   * #CERTIFICATE_CHAIN_PATTERN}.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkCertificateChain(value) {
    return MustBe.string(value, this.CERTIFICATE_CHAIN_PATTERN);
  }

  /**
   * Checks that a given value is a string matching {@link
   * #PRIVATE_KEY_PATTERN}.
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
   * @param {boolean} [multiple = false] Allow multiple PEM sections?
   * @returns {string} The constructed pattern.
   */
  static #makePemPattern(label, multiple = false) {
    const base64Line = '[/+a-zA-Z0-9]{1,80}';
    const body       = `(${base64Line}\n+){0,500}${base64Line}={0,2}\n+`;
    const oneBlock   =
        '\n*'
      + `-----BEGIN ${label}-----\n+`
      + body
      + `-----END ${label}-----\n+`;

    return multiple
      ? `^(${oneBlock})+$`
      : `^${oneBlock}$`;
  }
}
