// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as tls from 'node:tls';

import { HostItem } from '@this/app-config';
import { JsonSchemaUtil } from '@this/json';


/**
 * "Controller" for a single host entry, which can notably offer services for
 * multiple different hosts.
 */
export class HostController {
  /**
   * @type {string[]} List of hostnames, including partial or full wildcards.
   */
  #names;

  /** @type {string} Certificate, in PEM form. */
  #cert;

  /** @type {string} Key, in PEM form. */
  #key;

  /**
   * @type {tls.SecureContext} TLS context representing this instance's info.
   */
  #secureContext;

  /**
   * Constructs an insance.
   *
   * @param {HostItem} hostItem Parsed configuration item.
   */
  constructor(hostItem) {
    const { hostnames, certificate, privateKey } = hostItem;

    this.#names         = hostnames;
    this.#cert          = certificate;
    this.#key           = privateKey;
    this.#secureContext = tls.createSecureContext({ certificate, privateKey });
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

  /**
   * @returns {tls.SecureContext} TLS context representing this instance's info.
   */
  get secureContext() {
    return this.#secureContext;
  }
}
