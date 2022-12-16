// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { MustBe } from '@this/typey';


/**
 * Utilities for parsing various sorts of certificatey stuff.
 */
export class Certificates {
  /**
   * Checks that a given value is a string containing a standard-form PEM
   * certificate chain file.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkCertificateChain(value) {
    const pattern = this.#makePemPattern('CERTIFICATE', true);
    return MustBe.string(value, pattern);
  }

  /**
   * Checks that a given value is a string containing a standard-form PEM key
   * file.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static checkPrivateKey(value) {
    const pattern = this.#makePemPattern('PRIVATE KEY');
    return MustBe.string(value, pattern);
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
