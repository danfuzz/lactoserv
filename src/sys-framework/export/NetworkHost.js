// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';
import * as tls from 'node:tls';

import pem from 'pem';

import { BaseComponent, BaseConfig } from '@this/compote';
import { HostUtil } from '@this/net-util';
import { Certificates, Util } from '@this/sys-config';
import { MustBe } from '@this/typey';


/**
 * Component (in the sense of `compote`) which represents one configured "host"
 * item, which can notably cover multiple different hostnames. This class is
 * mostly concerned with the mapping between hostnames and certificates, and as
 * such the class doesn't do _that_ much.
 */
export class NetworkHost extends BaseComponent {
  /**
   * The component name to use for this instance, or `null` if not yet
   * calculated.
   *
   * @type {?string}
   */
  #name = null;

  /**
   * The certificate and for this instance, if known.
   *
   * @type {?{certificate: string, privateKey: string}}
   */
  #parameters = null;

  /**
   * Promise for value of {@link #parameters}, if it is not yet (effectively)
   * resolved.
   *
   * @type {Promise}
   */
  #parametersPromise = null;

  /**
   * TLS context representing this instance's info, lazily initialized.
   *
   * @type {?tls.SecureContext}
   */
  #secureContext = null;

  /**
   * Constructs an instance.
   *
   * @param {object} rawConfig Raw configuration object.
   */
  constructor(rawConfig) {
    super(rawConfig);

    const { config } = this;
    const { certificate, privateKey, selfSigned } = config;

    if (selfSigned) {
      this.#parametersPromise = NetworkHost.#makeSelfSignedParameters(config);
      (async () => {
        this.#parameters        = await this.#parametersPromise;
        this.#parametersPromise = null;
      })();
    } else {
      this.#parameters = { certificate, privateKey };
    }
  }

  /** @override */
  get name() {
    if (this.#name === null) {
      const { hostnames } = this.config;

      const firstName = hostnames[0].replace(/[*]/, '_star_');

      this.#name = (hostnames.length === 1)
        ? firstName
        : `${firstName}+${hostnames.length - 1}`;
    }

    return this.#name;
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

  /** @override */
  async _impl_init(isReload_unused) {
    // No need to do anything.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // No need to do anything.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // No need to do anything.
  }


  //
  // Static members.
  //

  /** @override */
  static _impl_configClass() {
    return this.#Config;
  }

  /**
   * If given a `Buffer` or `Uint8Array` in general, converts it to a string,
   * interpreting bytes as UTF-8. Otherwise, just passes the value through
   * as-is.
   *
   * @param {*} value Value in question.
   * @returns {*} `value` converted to a string if it was a `Buffer`,
   *   otherwise `value`.
   */
  static #bufferFilter(value) {
    if (value instanceof Uint8Array) {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      return decoder.decode(value);
    } else {
      return value;
    }
  }

  /**
   * Makes the parameters for a newly-generated self-signed certificate and
   * corresponding key.
   *
   * @param {NetworkHost.Config} config Parsed configuration item.
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

  /**
   * Configuration item subclass for this (outer) class.
   */
  static #Config = class Config extends BaseConfig {
    /**
     * The hostnames in question.
     *
     * @type {Array<string>}
     */
    #hostnames;

    /**
     * The certificate, as PEM-encoded data.
     *
     * @type {string}
     */
    #certificate;

    /**
     * The private key, as PEM-encoded data.
     *
     * @type {string}
     */
    #privateKey;

    /**
     * Is this to be a self-signed certificate?
     *
     * @type {boolean}
     */
    #selfSigned;

    /**
     * Constructs an instance.
     *
     * @param {object} rawConfig Raw configuration object.
     */
    constructor(rawConfig) {
      super(rawConfig);

      const { hostnames, certificate, privateKey, selfSigned = false } = rawConfig;

      this.#hostnames = Util.checkAndFreezeStrings(
        hostnames,
        (item) => HostUtil.checkHostname(item, true));

      this.#selfSigned = MustBe.boolean(selfSigned);

      if (selfSigned) {
        if ((certificate !== undefined) && (certificate !== null)) {
          throw new Error('Cannot use `certificate` with `selfSigned === true`.');
        }
        if ((privateKey !== undefined) && (privateKey !== null)) {
          throw new Error('Cannot use `certificate` with `selfSigned === true`.');
        }
        this.#certificate = null;
        this.#privateKey  = null;
      } else {
        this.#certificate =
          Certificates.checkCertificateChain(NetworkHost.#bufferFilter(certificate));
        this.#privateKey =
          Certificates.checkPrivateKey(NetworkHost.#bufferFilter(privateKey));
      }
    }

    /**
     * @returns {Array<string>} List of hostnames, including possibly subdomain
     * and/or full wildcards.
     */
    get hostnames() {
      return this.#hostnames;
    }

    /**
     * @returns {?string} The certificate as PEM-encoded data, or `null` if
     * {@link #selfSigned} is `true`.
     */
    get certificate() {
      return this.#certificate;
    }

    /**
     * @returns {?string} The private key as PEM-encoded data, or `null` if
     * {@link #selfSigned} is `true`.
     */
    get privateKey() {
      return this.#privateKey;
    }

    /** @returns {boolean} Is this entry to use a self-signed certificate? */
    get selfSigned() {
      return this.#selfSigned;
    }
  };
}
