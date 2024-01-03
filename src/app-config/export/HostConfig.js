// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseConfig } from '#x/BaseConfig';
import { Certificates } from '#x/Certificates';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';


/**
 * Configuration representation for a "host" item, that is, a thing that
 * defines the mapping from one or more names to a certificate / key pair.
 *
 * Accepted configuration bindings (in the constructor).
 *
 * * `{string|string[]} hostnames` -- Names of the hosts associated with this
 *   entry. Names can in the form `*.<name>` to match any subdomain of `<name>`,
 *   or `*` to be a complete wildcard (that is, matches any name not otherwise
 *   mentioned). Required.
 * * `{string|Buffer} certificate` -- The certificate chain for `hostnames`, as
 *   PEM-encoded data. Required if `selfSigned` is absent or `false`.
 * * `{string|Buffer} privateKey` -- The private key associated with
 *   `certificate`, as PEM-encoded data. Required if `selfSigned` is absent or
 *   `false`.
 * * `{boolean} selfSigned` -- Optional indicator of whether this entry should
 *   use a self-signed certificate.
 */
export class HostConfig extends BaseConfig {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} The certificate, as PEM-encoded data. */
  #certificate;

  /** @type {string} The private key, as PEM-encoded data. */
  #privateKey;

  /** @type {boolean} Is this to be a self-signed certificate? */
  #selfSigned;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration object. See class header for details.
   */
  constructor(config) {
    super(config);

    const { hostnames, certificate, privateKey, selfSigned = false } = config;

    this.#hostnames = Util.checkAndFreezeStrings(
      hostnames,
      (item) => Uris.checkHostname(item, true));

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
   * @returns {string[]} List of hostnames, including possibly subdomain and/or
   * full wildcards.
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
