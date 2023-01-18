// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import * as tls from 'node:tls';

import { HostConfig } from '@this/app-config';


/**
 * "Controller" for a single host entry, which can notably offer services for
 * multiple different hosts. "Hosts" in this sense are network-available servers
 * associated with particular names, certificates, and private keys. The main
 * thing offered by this class is the association between a named host and a TLS
 * context.
 */
export class HostController {
  /** @type {HostConfig} Configuration which defined this instance. */
  #config;

  /**
   * @type {tls.SecureContext} TLS context representing this instance's info.
   */
  #secureContext;

  /**
   * Constructs an insance.
   *
   * @param {HostConfig} config Parsed configuration item.
   */
  constructor(config) {
    const { certificate, privateKey } = config;

    this.#config        = config;
    this.#secureContext = tls.createSecureContext({
      cert: certificate,
      key:  privateKey
    });
  }

  /** @returns {HostConfig} Configuration which defined this instance. */
  get config() {
    return this.#config;
  }

  /**
   * @returns {tls.SecureContext} TLS context representing this instance's info.
   */
  get secureContext() {
    return this.#secureContext;
  }
}
