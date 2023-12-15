// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';
import * as tls from 'node:tls';

import pem from 'pem';

import { HostConfig } from '@this/app-config';


/**
 * Representation of one configured "host" item, which can notably cover
 * multiple different hostnames.
 */
export class HostItem {
  /** @type {HostConfig} Configuration which defined this instance. */
  #config;

  /**
   * @type {?tls.SecureContext} TLS context representing this instance's info,
   * if it is in fact ready.
   */
  #secureContext = null;

  /**
   * @type {Promise<tls.SecureContext>} Promise for {@link #secureContext}, if
   * it is not yet resolved.
   */
  #scPromise = null;

  /**
   * Constructs an instance.
   *
   * @param {HostConfig} config Parsed configuration item.
   */
  constructor(config) {
    const { certificate, privateKey, selfSigned } = config;

    this.#config = config;

    if (selfSigned) {
      this.#scPromise = HostItem.#makeSelfSignedContext(config);
      (async () => {
        this.#secureContext = await this.#scPromise;
        this.#scPromise     = null;
      })();
    } else {
      this.#secureContext = tls.createSecureContext({
        cert: certificate,
        key:  privateKey
      });
    }
  }

  /** @returns {HostConfig} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /**
   * Gets the TLS context. Note: This is `async` and not just a getter, because
   * in some cases the context is only generated asynchronously.
   *
   * @returns {tls.SecureContext} The TLS context.
   */
  async getSecureContext() {
    return this.#secureContext ?? await this.#scPromise;
  }


  //
  // Static members
  //

  /**
   * Creates a TLS context with a newly-generated self-signed certificate and
   * corresponding key.
   *
   * @param {HostConfig} config Parsed configuration item.
   * @returns {tls.SecureContext} Constructed context.
   */
  static async #makeSelfSignedContext(config) {
    // TODO: If a certificate made this way is offered as the catch-all for
    // when SNI isn't used, and an incoming request is for an IP address (not a
    // DNS name), then the server will silently fail (but not crash). Unclear
    // what's going on. Probably needs to be sorted out.

    const altNames = [];
    for (let i = 0; i < config.hostnames.length; i++) {
      const name = config.hostnames[i];
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
    commonName = ${config.hostnames[0]}

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
      commonName: config.hostnames[0],
      config:     certConfig
    });

    return tls.createSecureContext({
      cert: pemResult.certificate,
      key:  pemResult.clientKey
    });
  }
}
