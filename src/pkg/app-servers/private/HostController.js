// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as tls from 'node:tls';

// Types referenced only in doc comments.
import { SecureContext } from '#p/SecureContext';

/**
 * "Controller" for a single host entry, which can notably offer services for
 * multiple different hosts.
 */
export class HostController {
  /** {string[]} List of hostnames, including partial or full wildcards. */
  #names;

  /** {string} Certificate, in PEM form. */
  #cert;

  /** {string} Key, in PEM form. */
  #key;

  /** {SecureContext} TLS context representing this instance's info. */
  #secureContext;

  /**
   * Constructs an insance.
   *
   * @param {object} hostConfig Host configuration item.
   */
  constructor(hostConfig) {
    const nameArray = hostConfig.name ? [hostConfig.name] : [];
    const namesArray = hostConfig.names ?? [];
    this.#names = [...nameArray, ...namesArray];

    this.#cert = hostConfig.cert;
    this.#key = hostConfig.key;

    this.#secureContext = tls.createSecureContext({
      cert: this.#cert,
      key:  this.#key
    });
  }

  /**
   * @returns {string[]} List of hostnames, including partial or full wildcards.
   */
  get names() {
    return this.#names;
  }

  /** @returns {string} Certificate, in PEM form. */
  get cert() {
    return this.#cert;
  }

  /** @returns {string} Key, in PEM form. */
  get key() {
    return this.#key;
  }

  /** @returns {SecureContext} TLS context representing this instance's info. */
  get secureContext() {
    return this.#secureContext;
  }
}
