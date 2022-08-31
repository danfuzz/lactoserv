// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MustBe } from '@this/typey';

import * as tls from 'node:tls';

// Types referenced only in doc comments.
import { SecureContext } from 'node:tls';

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

  /** @type {SecureContext} TLS context representing this instance's info. */
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


  //
  // Static members.
  //

  /**
   * @returns {string} Regex pattern which matches a hostname, but _not_
   * anchored to only match a full string.
   */
  static get HOSTNAME_PATTERN_FRAGMENT() {
    const simpleName = '(?!-)[-a-zA-Z0-9]+(?<!-)';
    return '(?:' +
          '[*]' +
          '|' +
          `(?:[*][.])?(?:${simpleName}[.])*${simpleName}` +
          ')';
  }

  /**
   * @returns {string} Regex pattern which matches a hostname, anchored so that
   * it matches a complete string.
   *
   * This pattern allows regular dotted names (`foo.example.com`), regular names
   * prefixed with a wildcard (`*.example.com`), and complete wildcards (`*`).
   * Name components must not start or end with a dash.
   */
  static get HOSTNAME_PATTERN() {
    return `^${this.HOSTNAME_PATTERN_FRAGMENT}$`;
  }

  /**
   * @returns {RegExp} Regular expression that matches {@link
   * #HOSTNAME_PATTERN}.
   */
  static get HOSTNAME_REGEXP() {
    return new RegExp(this.HOSTNAME_PATTERN);
  }

  /**
   * Parses a possibly-wildcarded hostname into an object with path info.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcards = false] Is a wildcard form allowed for
   *   `name`?
   * @returns {{path: string[], wildcard: boolean}} Binding info. Because
   *   hostname wildcards are at the front of the name, the `path` lists
   *   components in back-to-front order.
   * @throws {Error} Thrown if `name` is invalid.
   */
  static pathFromName(name, allowWildcards = false) {
    MustBe.string(name, this.HOSTNAME_REGEXP);
    const path = name.split('.').reverse();
    let wildcard = false;

    if (path[path.length - 1] === '*') {
      path.pop();
      wildcard = true;
    }

    if (wildcard && !allowWildcards) {
      throw Error(`Wildcard not allowed for name: ${name}`);
    }

    return { path, wildcard };
  }
}
