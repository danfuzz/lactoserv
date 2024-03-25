// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { PathRouter } from '@this/built-ins';
import { DispatchInfo, IntfIncomingRequest, IntfRequestHandler,
  OutgoingResponse } from '@this/net-util';
import { BaseApplication, BaseControllable, ControlContext, RootControlContext }
  from '@this/sys-framework';

// TODO: This file contains a lot of mock implementation that should be
// extracted for reuse.

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
  static mockCalls = [];

  // The default constructor is fine for this class.

  /** @override */
  async _impl_handleRequest(request, dispatch) {
    let succeed = true;

    const callInfo = { application: this, request, dispatch };
    MockApp.mockCalls.push(callInfo);

    if (this.mockHandler) {
      const handlerResult = this.mockHandler(callInfo);
      if (typeof handlerResult !== 'boolean') {
        return handlerResult;
      }
      succeed = handlerResult;
    }

    if (succeed) {
      const result = new OutgoingResponse();
      result.mockInfo = callInfo;
      return result;
    } else {
      return null;
    }
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
    throw new Error('Not expected to be called.');
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
  async function makeInstance(paths, { appCount = 1, handlerFunc = null } = {}) {
    const root = new NopControllable(new RootControlContext(null));
    await root.start();

    for (let i = 1; i <= appCount; i++) {
      const app = new MockApp(
        new MockApp.CONFIG_CLASS({ name: `mockApp${i}`, class: MockApp }));
      if (handlerFunc) {
        app.mockHandler = handlerFunc;
      }
      await app.init(new ControlContext(app, root, null));
      await app.start();
    }

    const pr = new PathRouter(
      new PathRouter.CONFIG_CLASS({
        name: 'myRouter',
        class: PathRouter,
        paths
      }));

    await pr.init(new ControlContext(pr, root, null));
    await pr.start();

    return pr;
  }

  describe('when dispatched to directly (as if directly from `NetworkEndpoint`)', () => {
    let pr = null;

    function extractCallInfo() {
      return MockApp.mockCalls.map(({ application, request, dispatch }) => {
        return {
          appName:    application.name,
          reqPathStr: request.pathnameString,
          basePath:   dispatch.base.path,
          extraPath:  dispatch.extra.path
        };
      });
    }

    describe('when the root has a wildcard match', () => {
      beforeEach(async () => {
        pr = await makeInstance(
          {
            '/*':     'mockApp1',
            '/':      'mockApp2',
            '/x/*':   'mockApp3',
            '/x':     'mockApp4',
            '/x/':    'mockApp5',
            '/x/y':   'mockApp6',
            '/x/y/z': 'mockApp7',
            '/a':     'mockApp8',
            '/z':     'mockApp9'
          },
          { appCount: 9, handlerFunc: () => false }
        );

        MockApp.mockCalls = [];
      });

      test.each`
      label | requestPath | expectInfo
      ----------
      ${'top level'}
      ${'/'}
      ${[
        { appName: 'mockApp2', basePath: [''], extraPath: []   },
        { appName: 'mockApp1', basePath: [],   extraPath: [''] }
      ]}
      ----------
      ${'exactly matched directory at root which also has a wildcard'}
      ${'/x/'}
      ${[
        { appName: 'mockApp5', basePath: ['x', ''], extraPath: []        },
        { appName: 'mockApp3', basePath: ['x'],     extraPath: ['']      },
        { appName: 'mockApp1', basePath: [],        extraPath: ['x', ''] }
      ]}
      ----------
      ${'exactly matched file at root which also has a wildcard'}
      ${'/x'}
      ${[
        { appName: 'mockApp4', basePath: ['x'], extraPath: []    },
        { appName: 'mockApp3', basePath: ['x'], extraPath: []    },
        { appName: 'mockApp1', basePath: [],    extraPath: ['x'] }
      ]}
      ----------
      ${'exactly matched file under subdirectory that does not have wildcard'}
      ${'/x/y/z'}
      ${[
        { appName: 'mockApp7', basePath: ['x', 'y', 'z'], extraPath: []              },
        { appName: 'mockApp3', basePath: ['x'],           extraPath: ['y', 'z']      },
        { appName: 'mockApp1', basePath: [],              extraPath: ['x', 'y', 'z'] }
      ]}
      `('calls correct handler chain for $label', async ({ requestPath, expectInfo }) => {
        const request = new MockRequest(requestPath);
        const result  = await pr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));

        // Fill in the `reqPathStr` for the expectation.
        for (const ei of expectInfo) {
          ei.reqPathStr = request.pathnameString;
        }

        expect(result).toBeNull();
        expect(extractCallInfo()).toEqual(expectInfo);
      });
    });

    describe('when the root does not have a wildcard match', () => {
      beforeEach(async () => {
        pr = await makeInstance(
          {
            '/':      'mockApp1',
            '/x/*':   'mockApp2',
            '/x':     'mockApp3',
            '/x/':    'mockApp4',
            '/x/y':   'mockApp5',
            '/x/y/z': 'mockApp6',
            '/a':     'mockApp7',
            '/z':     'mockApp8'
          },
          { appCount: 8, handlerFunc: () => false }
        );

        MockApp.mockCalls = [];
      });

      test.each`
      label | requestPath | expectInfo
      ----------
      ${'top level'}
      ${'/'}
      ${[
        { appName: 'mockApp1', basePath: [''], extraPath: [] }
      ]}
      ----------
      ${'exactly matched directory at root which also has a wildcard'}
      ${'/x/'}
      ${[
        { appName: 'mockApp4', basePath: ['x', ''], extraPath: []   },
        { appName: 'mockApp2', basePath: ['x'],     extraPath: [''] }
      ]}
      ----------
      ${'exactly matched file at root which also has a wildcard'}
      ${'/x'}
      ${[
        { appName: 'mockApp3', basePath: ['x'], extraPath: [] },
        { appName: 'mockApp2', basePath: ['x'], extraPath: [] }
      ]}
      ----------
      ${'exactly matched file under subdirectory that does not have wildcard'}
      ${'/x/y/z'}
      ${[
        { appName: 'mockApp6', basePath: ['x', 'y', 'z'], extraPath: []         },
        { appName: 'mockApp2', basePath: ['x'],           extraPath: ['y', 'z'] }
      ]}
      `('calls correct handler chain for $label', async ({ requestPath, expectInfo }) => {
        const request = new MockRequest(requestPath);
        const result  = await pr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));

        // Fill in the `reqPathStr` for the expectation.
        for (const ei of expectInfo) {
          ei.reqPathStr = request.pathnameString;
        }

        expect(result).toBeNull();
        expect(extractCallInfo()).toEqual(expectInfo);
      });
    });
  });

  test('stops trying fallbacks after it gets a result', async () => {
    const pr = await makeInstance(
      {
        '/*':     'mockApp1',
        '/x/*':   'mockApp2',
        '/x/y/*': 'mockApp3',
        '/x/y/z': 'mockApp4'
      },
      { appCount: 4, handlerFunc: ({ application }) => application.name === 'mockApp2' }
    );

    MockApp.mockCalls = [];

    const request = new MockRequest('/x/y/z');
    const result  = await pr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));

    expect(result).not.toBeNull();
    expect(result.mockInfo.application.name).toBe('mockApp2');

    const callNames = MockApp.mockCalls.map(({ application }) => application.name);
    expect(callNames).toEqual(['mockApp4', 'mockApp3', 'mockApp2']);
  });

  test('matches on `dispatch.extra` (not `request.pathname`)', async () => {
    const pr      = await makeInstance({ '/florp/floop/*': 'mockApp1' });
    const request = new MockRequest('/x/y/z');
    const result  = await pr.handleRequest(request,
      new DispatchInfo(TreePathKey.EMPTY, new TreePathKey(['florp', 'floop', 'bop'], false)));

    expect(result).not.toBeNull();

    const callInfo = result.mockInfo;
    expect(callInfo.application.name).toBe('mockApp1');
    expect(callInfo.request).toBe(request);
    expect(callInfo.dispatch.base.path).toEqual(['florp', 'floop']);
    expect(callInfo.dispatch.extra.path).toEqual(['bop']);
  });

  test('forms new `dispatch` by shifting items from `extra` to `base`', async () => {
    const pr      = await makeInstance({ '/zonk/*': 'mockApp1' });
    const request = new MockRequest('/x/y/z');
    const result  = await pr.handleRequest(request,
      new DispatchInfo(
        new TreePathKey(['beep'], false),
        new TreePathKey(['zonk', 'zorch', 'florp'], false)));

    expect(result).not.toBeNull();

    const callInfo = result.mockInfo;
    expect(callInfo.application.name).toBe('mockApp1');
    expect(callInfo.request).toBe(request);
    expect(callInfo.dispatch.base.path).toEqual(['beep', 'zonk']);
    expect(callInfo.dispatch.extra.path).toEqual(['zorch', 'florp']);
  });
});
