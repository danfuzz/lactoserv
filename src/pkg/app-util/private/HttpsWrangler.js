// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TcpWrangler } from '#p/TcpWrangler';

import express from 'express';

import * as https from 'node:https';

/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends TcpWrangler {
  // Note: Default constructor is fine here.

  /** @override */
  _impl_createApplication() {
    return express();
  }

  /** @override */
  _impl_createServer(hostOptions) {
    return https.createServer(hostOptions);
  }

  /** @override */
  async _impl_protocolStart() {
    // Nothing to do in this case.
  }

  /** @override */
  async _impl_protocolStop() {
    // Nothing to do in this case.
  }

  /** @override */
  async _impl_protocolWhenStopped() {
    // Nothing to do in this case.
  }
}
