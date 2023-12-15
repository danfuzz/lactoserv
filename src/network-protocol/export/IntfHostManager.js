// Copyright 2022-2023 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { SecureContext } from 'node:tls';

import { Methods } from '@this/typey';


/**
 * Interface for "host managers" as needed by this module. These are responsible
 * for looking up hostnames and reporting back secure context information.
 *
 * @interface
 */
export class IntfHostManager {
  /**
   * Finds the TLS {@link SecureContext} to use, based on the given hostname.
   *
   * @param {string} name Hostname to look for, which may be a partial or full
   *   wildcard.
   * @returns {?SecureContext} The associated {@link SecureContext}, or `null`
   *   if no hostname match is found.
   */
  async findContext(name) {
    Methods.abstract(name);
  }

  /**
   * Gets options suitable for use with `http2.createSecureServer()` and the
   * like, such that this instance will be used to find certificates and keys.
   *
   * @returns {object} Options for secure server/context construction.
   */
  async getSecureServerOptions() {
    Methods.abstract();
  }
}
