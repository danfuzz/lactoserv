// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import * as tls from 'node:tls';

import { TreePathKey } from '@this/collections';
import { JsonSchemaUtil } from '@this/json';
import { MustBe } from '@this/typey';


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
   * @param {object} hostConfig Host configuration item.
   */
  constructor(hostConfig) {
    const { cert, key, name, names } = hostConfig;

    this.#names         = JsonSchemaUtil.singularPluralCombo(name, names);
    this.#cert          = cert;
    this.#key           = key;
    this.#secureContext = tls.createSecureContext({ cert, key });
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
