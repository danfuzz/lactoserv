// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpWrangler } from '#p/HttpWrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';
import { ProtocolWrangler } from '#x/ProtocolWrangler';


/**
 * Utility class which constructs concrete {@link ProtocolWrangler} instances.
 */
export class ProtocolWranglers {
  /**
   * Map from each protocol name to the wrangler subclass that handles it.
   *
   * @type {Map<string, function(new:*, ...*)>}
   */
  static #WRANGLER_CLASSES = new Map(Object.entries({
    http:  HttpWrangler,
    http2: Http2Wrangler,
    https: HttpsWrangler
  }));

  /**
   * Constructs an instance for the given protocol. The given `options` must
   * include `protocol` to specify the protocol. Beyond that, see
   * {@link ProtocolWrangler} -- especially its constructor -- for more
   * information.
   *
   * @param {object} options Configuration options, per above.
   * @returns {ProtocolWrangler} Appropriately-constructed instance of a
   *   subclass of this class.
   */
  static make(options) {
    const protocol = options.protocol;

    const cls = this.#WRANGLER_CLASSES.get(protocol);
    if (!cls) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }

    return new cls(options);
  }

  /**
   * Checks that this module knows of a protocol by the given name.
   *
   * @param {string} name Protocol name.
   * @returns {string} `name` if it is a known protocol.
   * @throws {Error} Thrown if `name` is not a known protocol (or is not a
   *   string).
   */
  static checkProtocol(name) {
    MustBe.string(name);

    if (!this.#WRANGLER_CLASSES.has(name)) {
      throw new Error(`Unknown protocol: ${name}`);
    }

    return name;
  }
}
