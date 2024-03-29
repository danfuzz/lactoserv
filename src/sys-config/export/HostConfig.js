// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HostUtil } from '@this/net-util';
import { BaseConfig } from '@this/compote';
import { MustBe } from '@this/typey';

import { Certificates } from '#x/Certificates';
import { Util } from '#x/Util';


/**
 * Configuration representation for a "host" item, that is, a thing that defines
 * the mapping from one or more names to a certificate / key pair. See
 * `doc/configuration.md` for configuration object details.
 */
export class HostConfig extends BaseConfig {
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
        Certificates.checkCertificateChain(HostConfig.#bufferFilter(certificate));
      this.#privateKey =
        Certificates.checkPrivateKey(HostConfig.#bufferFilter(privateKey));
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


  //
  // Static members
  //

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
}
