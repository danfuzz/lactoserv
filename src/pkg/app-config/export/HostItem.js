// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseConfig } from '#x/BaseConfig';
import { Certificates } from '#x/Certificates';
import { Uris } from '#x/Uris';
import { Util } from '#x/Util';


/**
 * Configuration representation for a "host" item, that is, a thing that
 * defines the mapping from one or more names to a certificate / key pair.
 *
 * * `{string|string[]} hostnames` -- Names of the hosts associated with this
 *   entry. Names can in the form `*.<name>` to match any subdomain of `<name>`,
 *   or `*` to be a complete wildcard (that is, matches any name not otherwise
 *   mentioned).
 * * `{string} certificate` -- The certificate for `hostnames`, as PEM-encoded
 *   data.
 * * `{string} privateKey` -- The private key associated with `certificate`, as
 *   PEM-encoded data.
 *
 * Accepted configuration bindings (in the constructor). All are required:
 */
export class HostItem extends BaseConfig {
  /** @type {string[]} The hostnames in question. */
  #hostnames;

  /** @type {string} The certificate, as PEM-encoded data. */
  #certificate;

  /** @type {string} The private key, as PEM-encoded data. */
  #privateKey;

  /**
   * Constructs an instance.
   *
   * @param {object} config Configuration, per the class description.
   */
  constructor(config) {
    super(config);

    const { hostnames, certificate, privateKey } = config;

    this.#hostnames   = Util.checkAndFreezeStrings(hostnames, Uris.HOSTNAME_PATTERN);
    this.#certificate = Certificates.checkCertificate(certificate);
    this.#privateKey  = Certificates.checkPrivateKey(privateKey);
  }

  /**
   * @returns {string[]} List of hostnames, including possibly subdomain and/or
   * full wildcards.
   */
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
}
