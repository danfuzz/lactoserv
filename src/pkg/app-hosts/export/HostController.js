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
  /** @type {HostItem} Configuration which defined this instance. */
  #config;

  /**
   * @type {tls.SecureContext} TLS context representing this instance's info.
   */
  #secureContext;

  /**
   * Constructs an insance.
   *
   * @param {HostItem} config Parsed configuration item.
   */
  constructor(config) {
    const { certificate, privateKey } = config;

    this.#config        = config;
    this.#secureContext = tls.createSecureContext({ certificate, privateKey });
  }

  /** @returns {HostItem} Configuration which defined this instance. */
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
