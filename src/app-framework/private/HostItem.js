// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as tls from 'node:tls';

import { HostConfig } from '@this/app-config';


/**
 * Representation of one configured "host" item, which can notably cover
 * multiple different hostnames.
 */
export class HostItem {
  /** @type {HostConfig} Configuration which defined this instance. */
  #config;

  /**
   * @type {tls.SecureContext} TLS context representing this instance's info.
   */
  #secureContext;

  /**
   * Constructs an instance.
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
