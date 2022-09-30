// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { ProtocolWrangler } from '#x/ProtocolWrangler';

import express from 'express';

import * as https from 'node:https';

/**
 * Wrangler for `HttpsServer`.
 */
export class HttpsWrangler extends ProtocolWrangler {
  // Note: Default constructor is fine here.

  /** @override */
  createApplication() {
    return express();
  }

  /** @override */
  createServer(certOptions) {
    return https.createServer(certOptions);
  }

  /** @override */
  async protocolStart() {
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

  /** @override */
  usesCertificates() {
    return true;
  }
}
