// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TreePathKey } from '@this/collections';
import { JsonSchemaUtil } from '@this/json';
import { MustBe } from '@this/typey';

import * as tls from 'node:tls';

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


  //
  // Static members.
  //

  /**
   * @returns {string} Regex pattern which matches a hostname, anchored so that
   * it matches a complete string.
   *
   * This pattern allows regular dotted names (`foo.example.com`), regular names
   * prefixed with a wildcard (`*.example.com`), and complete wildcards (`*`).
   * Name components are non-empty strings of alphanumerics plus `-`, which
   * furthermore must not start or end with a dash.
   */
  static get HOSTNAME_PATTERN() {
    return `^${this.HOSTNAME_PATTERN_FRAGMENT}$`;
  }

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
   * @returns {RegExp} Regular expression that matches {@link
   * #HOSTNAME_PATTERN}.
   */
  static get HOSTNAME_REGEXP() {
    return new RegExp(this.HOSTNAME_PATTERN);
  }

  /**
   * Parses a possibly-wildcarded hostname into a {@link TreePathKey}.
   *
   * **Note:** Because hostname hierarchy is from right-to-left (e.g., wildcards
   * are at the front of a hostname not the back), the `.path` of the result
   * contains the name components in back-to-front order.
   *
   * @param {string} name Hostname to parse.
   * @param {boolean} [allowWildcards = false] Is a wildcard form allowed for
   *   `name`?
   * @returns {TreePathKey} Parsed key.
   * @throws {Error} Thrown if `name` is invalid.
   */
  static parseName(name, allowWildcards = false) {
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

    return new TreePathKey(path, wildcard);
  }
}
