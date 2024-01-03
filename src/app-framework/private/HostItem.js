// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
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
   * @type {?{certificate: string, privateKey: string}} The certificate and
   * for this instance, if known.
   */
  #parameters = null;

  /**
   * @type {Promise} Promise for value of {@link #parameters}, if it is not yet
   * (effectively) resolved.
   */
  #parametersPromise = null;

  /**
   * @type {?tls.SecureContext} TLS context representing this instance's info,
   * lazily initialized.
   */
  #secureContext = null;

  /**
   * Constructs an instance.
   *
   * @param {HostConfig} config Parsed configuration item.
   */
  constructor(config) {
    const { certificate, privateKey, selfSigned } = config;

    this.#config = config;

    if (selfSigned) {
      this.#parametersPromise = HostItem.#makeSelfSignedParameters(config);
      (async () => {
        this.#parameters        = await this.#parametersPromise;
        this.#parametersPromise = null;
      })();
    } else {
      this.#parameters = { certificate, privateKey };
    }
  }

  /** @returns {HostConfig} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /**
   * Gets the TLS context. **Note:** This is `async` and not just a getter,
   * because in some cases the context can only be generated asynchronously.
   *
   * @returns {tls.SecureContext} The TLS context.
   */
  async getSecureContext() {
    if (!this.#secureContext) {
      const params = await this.getParameters();
      this.#secureContext = tls.createSecureContext({
        cert: params.certificate,
        key:  params.privateKey
      });
    }

    return this.#secureContext;
  }

  /**
   * Gets the resolved parameters -- specifically, the certificate and key --
   * for this instance. **Note:** This is `async` and not just a getter, because
   * in some cases the context is only generated asynchronously.
   *
   * @returns {{certificate: string, privateKey: string}} The parameters.
   */
  async getParameters() {
    return this.#parameters ?? await this.#parametersPromise;
  }


  //
  // Static members
  //

  /**
   * Makes the parameters for a newly-generated self-signed certificate and
   * corresponding key.
   *
   * @param {HostConfig} config Parsed configuration item.
   * @returns {{certificate: string, privateKey: string}} The parameters.
   */
  static async #makeSelfSignedParameters(config) {
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

    return {
      certificate: pemResult.certificate,
      privateKey:  pemResult.clientKey
    };
  }
}
