// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';

import pem from 'pem/lib/pem.js';

import { MustBe } from '@this/typey';

// Note: See <https://github.com/Dexus/pem/issues/389> about the import of
// `pem/lib/pem`.

/**
 * Utilities for handling various sorts of certificatey stuff.
 */
export class CertUtil {
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
    const pattern = this.#makePemPattern('(RSA )?PRIVATE KEY');
    return MustBe.string(value, pattern);
  }

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

    const certConfig = `
    [req]
    req_extensions = v3_req
    distinguished_name = req_distinguished_name

    [req_distinguished_name]
    commonName = ${hostnames[0]}

    [v3_req]
    keyUsage = digitalSignature
    extendedKeyUsage = serverAuth
    subjectAltName = @alt_names

    [alt_names]
    ${altNames.join('\n')}
    `;

    const pemResult = await pem.promisified.createCertificate({
      selfSigned: true,
      days:       100,
      keyBitsize: 4096,
      commonName: hostnames[0],
      config:     certConfig
    });

    let { certificate, clientKey: privateKey } = pemResult;

    if (!certificate.endsWith('\n')) {
      certificate = `${certificate}\n`;
    }

    if (!privateKey.endsWith('\n')) {
      privateKey = `${privateKey}\n`;
    }

    return { certificate, privateKey };
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
