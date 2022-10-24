// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

import { Certificates } from '#x/Certificates';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';

/**
 * Configuration representation for a "host" item, that is, a thing that
 * defines the mapping from one or more names to a certificate / key pair.
 */
export class HostItem {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} The certificate, as PEM-encoded data. */
  #certificate;

  /** @type {string} The private key, as PEM-encoded data. */
  #privateKey;

  /**
   * Constructs an instance. Accepted configuration bindings:
   *
   * * `{string|string[]} hostnames` -- The hostname(s) in question.
   * * `{string} certificate` -- The certificate for `hostnames`, as PEM-encoded
   *   data.
   * * `{string} privateKey` -- The private key for `hostnames`, as PEM-encoded
   *   data.
   *
   * All of these are required.
   *
   * @param {object} config Configuration, per the above description.
   */
  constructor(config) {
    const { hostnames, certificate, privateKey } = config;

    this.#hostnames   = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#certificate = Certificates.checkCertificate(certificate);
    this.#privateKey  = Certificates.checkPrivateKey(privateKey);
  }

  /** @returns {string[]} The hostnames in question. */
  get hostnames() {
    return this.#hostnames;
  }

  /** @returns {string} The certificate, as PEM-encoded data. */
  get certificate() {
    return this.#certificate;
  }

  /** @returns {string} The private key, as PEM-encoded data. */
  get privateKey() {
    return this.#privateKey;
  }


  //
  // Static members
  //

  /**
   * Parses a single configuration object or array of them into an array of
   * instances of this class.
   *
   * @param {*} items Array of configuration objects, as described by this
   *   class's constructor
   * @returns {HostItem[]} Frozen array of instances of this class, if
   *   successfully parsed.
   * @throws {Error} Thrown if there was any trouble.
   */
  static parseArray(items) {
    if (!Array.isArray(items)) {
      items = [items];
    }

    MustBe.arrayOfPlainObject(items);

    const result = items.map(item => new this(item));
    return Object.freeze(result);
  }
}
