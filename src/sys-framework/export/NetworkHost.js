// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as net from 'node:net';
import * as tls from 'node:tls';

import pem from 'pem';

import { BaseComponent, BaseConfig } from '@this/compote';
import { CertUtil, HostUtil } from '@this/net-util';
import { MustBe, StringUtil } from '@this/typey';


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
   * TLS context representing this instance's info, lazily initialized.
   *
   * @type {?tls.SecureContext}
   */
  #secureContext = null;

  // @defaultConstructor

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
   * Gets the TLS context.
   *
   * **Note:** This is only valid to use after the instance has been
   * `start()`ed.
   *
   * @returns {tls.SecureContext} The TLS context.
   */
  getSecureContext() {
    if (!this.#secureContext) {
      const params = this.getParameters();
      this.#secureContext = tls.createSecureContext({
        cert: params.certificate,
        key:  params.privateKey
      });
    }

    return this.#secureContext;
  }

  /**
   * Gets the resolved parameters -- specifically, the certificate and key --
   * for this instance.
   *
   * **Note:** This is only valid to use after the instance has been
   * `start()`ed.
   *
   * @returns {{certificate: string, privateKey: string}} The parameters.
   */
  getParameters() {
    const result = this.#parameters;

    if (!result) {
      throw new Error(`Host ${this.name} not yet started.`);
    }

    return result;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    const { config } = this;
    const { selfSigned } = config;

    if (selfSigned) {
      this.#parameters = await NetworkHost.#makeSelfSignedParameters(config);
    } else {
      const { certificate, privateKey } = config;
      this.#parameters = { certificate, privateKey };
    }
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
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
   * @returns {*} `value` converted to a string if it was a `Buffer`, otherwise
   *   `value`.
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

      this.#hostnames = StringUtil.checkAndFreezeStrings(
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
          CertUtil.checkCertificateChain(NetworkHost.#bufferFilter(certificate));
        this.#privateKey =
          CertUtil.checkPrivateKey(NetworkHost.#bufferFilter(privateKey));
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
