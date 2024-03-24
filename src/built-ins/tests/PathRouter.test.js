// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { PathRouter } from '@this/built-ins';
import { DispatchInfo, IntfIncomingRequest, IntfRequestHandler,
  OutgoingResponse } from '@this/net-util';
import { BaseApplication, BaseControllable, ControlContext, RootControlContext }
  from '@this/sys-framework';

// TODO: This contains a lot of mock implementation that should be extracted for
// reuse.

/**
 * Minimal concrete subclass of `BaseControllable`, which has no-op
 * implementations for all `_impl_*` methods.
 */
export class NopControllable extends BaseControllable {
  // The default constructor is fine for this class.

  /** @override */
  async _impl_init(isReload_unused) {
    // This space intentionally left blank.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // This space intentionally left blank.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // This space intentionally left blank.
  }
}

/**
 * @implements {IntfRequestHandler}
 */
class MockApp extends BaseApplication {
  // The default constructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    const result = new OutgoingResponse();
    result.mockInfo = { handler: this, request, dispatch };
    return result;
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // This space intentionally left blank.
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // This space intentionally left blank.
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // This space intentionally left blank.
  }
}

/**
 * @implements {IntfIncomingRequest}
 */
class MockRequest {
  #pathString;
  #pathKey;

  constructor(pathString) {
    this.#pathString = pathString;

    // `slice(1)` to avoid having an empty component as the first element. And
    // Freezing `parts` lets `new TreePathKey()` avoid making a copy.
    const pathParts = Object.freeze(pathString.slice(1).split('/'));
    this.#pathKey = new TreePathKey(pathParts, false);
  }

  /** @override */
  get cookies() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get headers() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get host() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get id() {
    return 'mock-id';
  }

  /** @override */
  get logger() {
    return null;
  }

  /** @override */
  get method() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get origin() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get pathname() {
    return this.#pathKey;
  }

  /** @override */
  get pathnameString() {
    return this.#pathString;
  }

  /** @override */
  get protocolName() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get searchString() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get targetString() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  get urlForLogging() {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  getHeaderOrNull(name_unused) {
    throw new Error('Not expected to be called.');
  }

  /** @override */
  getLoggableRequestInfo() {
    throw new Error('Not expected to be called.');
  }
}

describe('_impl_handleRequest()', () => {
  async function makeInstance(paths) {
    const app = new MockApp(
      new MockApp.CONFIG_CLASS({ name: 'mockApp', class: MockApp }));
    const pr = new PathRouter(
      new PathRouter.CONFIG_CLASS({
        name: 'myRouter',
        class: PathRouter,
        paths
      }));

    const root = new NopControllable(new RootControlContext(null));
    await root.start();
    await app.init(new ControlContext(app, root, null));
    await pr.init(new ControlContext(pr, root, null));
    await app.start();
    await pr.start();

    return pr;
  }

  test('provides proper `extra` when routing to `/`', async () => {
    const pr      = await makeInstance({ '/': 'mockApp' });
    const req     = new MockRequest('/');
    const result  = await pr.handleRequest(req, new DispatchInfo(TreePathKey.EMPTY, req.pathname));

    expect(result).not.toBeNull();
    // TODO: More!
  });

  test('provides proper `extra` when routing to `/*`', () => {
    // TODO
  });

  test('provides proper `extra` when routing to `/x`', () => {
    // TODO
  });

  test('provides proper `extra` when routing to `/x/`', () => {
    // TODO
  });

  test('provides proper `extra` when routing to `/x/*`', () => {
    // TODO
  });
});
