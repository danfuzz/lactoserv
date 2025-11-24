// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';

import selfsigned from 'selfsigned';

import { MustBe } from '@this/typey';


// Note: See <https://github.com/Dexus/pem/issues/389> about the import of
// `pem/lib/pem`.

/**
 * Utilities for handling various sorts of certificatey stuff.
 */
export class CertUtil {
  /**
   * Generates a self-signed (certificate, private key) pair. **Note:** This
   * takes user-visible time (around a second or so typically).
   *
   * @param {Array<string>} hostnames Array of hostnames, the first of which is
   *   the primary hostname. Must have at least one element in it.
   * @returns {{certificate: string, privateKey: string}} The parameters.
   */
  static async makeSelfSignedPair(hostnames) {
    MustBe.arrayOfString(hostnames);

    if (hostnames.length < 1) {
      throw new Error('Must have at least a primary hostname.');
    }

    const altNames = [];
    for (let i = 0; i < hostnames.length; i++) {
      const name = hostnames[i];
      if (net.isIP(name) === 0) {
        altNames.push(`DNS.${i} = ${name}`);
      } else {
        altNames.push(`IP.${i} = ${name}`);
      }
    }

    const attributes = [
      { name: 'commonName', value: hostnames[0] }
    ];

    const options = {
      keySize:   2048,
      days:      100,
      algorithm: 'sha256'
    };

    const pemResult = selfsigned.generate(attributes, options);

    const { cert: certificate, private: privateKey } = pemResult;

    return { certificate, privateKey };
  }

  /**
   * Checks that a given value is a string containing a standard-form PEM
   * certificate chain file.
   *
   * @param {*} value Value in question.
   * @returns {string} `value` if it is a string which matches the stated
   *   pattern.
   * @throws {Error} Thrown if `value` does not match.
   */
  static mustBeCertificateChain(value) {
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
  static mustBePrivateKey(value) {
    const pattern = this.#makePemPattern('((RSA|EC) )?PRIVATE KEY');
    return MustBe.string(value, pattern);
  }

  /**
   * Makes a PEM-matching pattern.
   *
   * @param {string} label The label to match.
   * @param {boolean} [multiple] Allow multiple PEM sections?
   * @returns {string} The constructed pattern.
   */
  static #makePemPattern(label, multiple = false) {
    const base64Line = '[/+a-zA-Z0-9]{1,80}';
    const body       = `(${base64Line}[\r\n]+){0,500}${base64Line}={0,2}[\r\n]+`;
    const oneBlock   =
      '[\r\n]*'
      + `-----BEGIN ${label}-----[\r\n]+`
      + body
      + `-----END ${label}-----[\r\n]*`;

    return multiple
      ? `^(${oneBlock})+$`
      : `^${oneBlock}$`;
  }
}
