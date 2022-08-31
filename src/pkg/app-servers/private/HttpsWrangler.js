// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { BaseWrangler } from '#p/BaseWrangler';

import express from 'express';

import * as https from 'node:https';

/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends BaseWrangler {
  // Note: Default constructor is fine here.

  /** @override */
  createApplication() {
    return express();
  }

  /** @override */
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

  /** @override */
  async protocolStart(server_unused) {
    // Nothing to do in this case.
  }

  /** @override */
  async protocolStop() {
    // Nothing to do in this case.
  }

  /** @override */
  async protocolWhenStopped() {
    // Nothing to do in this case.
  }
}
