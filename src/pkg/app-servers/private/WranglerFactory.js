// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { HttpWrangler } from '#p/HttpWrangler';
import { Http2Wrangler } from '#p/Http2Wrangler';
import { HttpsWrangler } from '#p/HttpsWrangler';

/**
 * Utility class which constructs of concrete {@link BaseWrangler} instances.
 */
export class WranglerFactory {
  /** {Map<string, class>} Map from each protocol name to the wrangler subclass
   * that handles it. */
  static #WRANGLER_CLASSES = new Map(Object.entries({
    http:  HttpWrangler,
    http2: Http2Wrangler,
    https: HttpsWrangler
  }));

  /**
   * Constructs an instance for the given protocol.
   *
   * @param {string} protocol Protocol to use.
   * @param {ActualServer|null} actual Controlling instance.
   * @returns {BaseWrangler} Appropriately-constructed instance of a subclass of
   *   this class.
   */
  static forProtocol(protocol, actual) {
    const cls = this.#WRANGLER_CLASSES.get(protocol);
    if (cls === null) {
      throw new Error(`Unknown protocol: ${protocol}`);
    }

    return new cls(actual);
  }
}
