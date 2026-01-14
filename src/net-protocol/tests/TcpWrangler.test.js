// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';

import { PromiseState } from '@this/async';
import { InterfaceAddress } from '@this/net-util';

import { TcpWrangler } from '#p/TcpWrangler';


/**
 * Mock socket for testing, providing the minimal interface needed.
 */
class MockSocket extends EventEmitter {
  /** @type {boolean} */
  destroyed = false;

  /**
   * Destroys the socket.
   */
  destroy() {
    if (!this.destroyed) {
      this.destroyed = true;
      this.emit('close');
    }
  }
}

/**
 * Minimal concrete subclass of TcpWrangler for testing.
 */
class TestTcpWrangler extends TcpWrangler {
  /** @override */
  get _impl_infoForLog() {
    return { test: true };
  }

  /** @override */
  async _impl_init() {
    // @emptyBlock
  }

  /** @override */
  async _impl_serverStart() {
    // @emptyBlock
  }

  /** @override */
  async _impl_serverStop(_willReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_newConnection(_context_unused) {
    // @emptyBlock
  }

  /**
   * Exposes the protected method for testing.
   *
   * @param {number} gracePeriodMsec Grace period.
   * @returns {Promise<void>} Resolves when complete.
   */
  async closeSocketsWithGracePeriod(gracePeriodMsec) {
    return this._prot_closeSocketsWithGracePeriod(gracePeriodMsec);
  }

  /**
   * Adds a socket for testing.
   *
   * @param {object} socket The socket to add.
   */
  addSocket(socket) {
    this._testing_addSocket(socket);
  }
}

/**
 * Creates a TestTcpWrangler instance.
 *
 * @returns {TestTcpWrangler} The instance.
 */
function makeWrangler() {
  const iface = new InterfaceAddress('*:8080');
  return new TestTcpWrangler({
    interface:      iface,
    protocol:       'http',
    requestHandler: { handleRequest: () => null }
  });
}


describe('_prot_closeSocketsWithGracePeriod()', () => {
  test('returns immediately when there are no sockets', async () => {
    const wrangler = makeWrangler();
    const result   = wrangler.closeSocketsWithGracePeriod(1000);

    // Should resolve immediately
    await setImmediate();
    expect(PromiseState.isFulfilled(result)).toBeTrue();
    await result;
  });

  test('returns immediately when all sockets close before grace period', async () => {
    const wrangler = makeWrangler();
    const socket   = new MockSocket();
    wrangler.addSocket(socket);

    const result = wrangler.closeSocketsWithGracePeriod(1000);

    // Should be pending initially
    await setImmediate();
    expect(PromiseState.isPending(result)).toBeTrue();

    // Close the socket
    socket.destroy();
    await setImmediate();

    // Should now be fulfilled
    expect(PromiseState.isFulfilled(result)).toBeTrue();
    await result;
  });

  test('force-destroys sockets after grace period expires', async () => {
    const wrangler = makeWrangler();
    const socket   = new MockSocket();
    wrangler.addSocket(socket);

    expect(socket.destroyed).toBeFalse();

    // Use a very short grace period for testing
    const result = wrangler.closeSocketsWithGracePeriod(10);

    // Wait for grace period to expire
    await result;

    // Socket should have been force-destroyed
    expect(socket.destroyed).toBeTrue();
  });

  test('handles multiple sockets, some closing before and some after grace period', async () => {
    const wrangler = makeWrangler();
    const socket1  = new MockSocket();
    const socket2  = new MockSocket();
    wrangler.addSocket(socket1);
    wrangler.addSocket(socket2);

    // Start with short grace period
    const result = wrangler.closeSocketsWithGracePeriod(50);

    // Close socket1 immediately
    socket1.destroy();
    expect(socket1.destroyed).toBeTrue();
    expect(socket2.destroyed).toBeFalse();

    // Wait for grace period to expire
    await result;

    // socket2 should have been force-destroyed
    expect(socket2.destroyed).toBeTrue();
  });

  test('does not re-destroy already-destroyed sockets', async () => {
    const wrangler = makeWrangler();
    const socket   = new MockSocket();
    wrangler.addSocket(socket);

    // Pre-destroy the socket but don't emit close
    socket.destroyed = true;

    let destroyCalled = false;
    const originalDestroy = socket.destroy.bind(socket);
    socket.destroy = () => {
      destroyCalled = true;
      originalDestroy();
    };

    // Use short grace period
    await wrangler.closeSocketsWithGracePeriod(10);

    // destroy() should not have been called since socket was already destroyed
    expect(destroyCalled).toBeFalse();
  });
});
