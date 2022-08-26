// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';

import * as https from 'https';

/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends BaseWrangler {
  // Note: Default constructor is fine here.

  /** Per superclass requirement. */
  createApplication() {
    return express();
  }

  /** Per superclass requirement. */
  createServer(hostManager) {
    // The `key` and `cert` bound here are for cases where the client doesn't
    // invoke the server-name extension. Hence, it's the wildcard.
    const wildcard = hostManager.findConfig('*');
    const sniCallback =
      (serverName, cb) => hostManager.sniCallback(serverName, cb);
    const serverOptions = {
      SNICallback: sniCallback,
      cert:        wildcard.cert,
      key:         wildcard.key
    };

    return https.createServer(serverOptions);
  }

  /** Per superclass requirement. */
  async protocolStart(server_unused) {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async protocolStop() {
    // Nothing to do in this case.
  }

  /** Per superclass requirement. */
  async protocolWhenStopped() {
    // Nothing to do in this case.
  }
}
