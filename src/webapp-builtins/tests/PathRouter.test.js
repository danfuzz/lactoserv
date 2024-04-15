// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { BaseComponent, BaseConfig, ControlContext, RootControlContext }
  from '@this/compote';
import { DispatchInfo, FullResponse, HttpHeaders, IncomingRequest,
  IntfRequestHandler, RequestContext }
  from '@this/net-util';
import { PathRouter } from '@this/webapp-builtins';
import { BaseApplication } from '@this/webapp-core';


// TODO: This file contains a lot of mock implementation that should be
// extracted for reuse.

/**
 * Minimal concrete subclass of `BaseComponent`, which has no-op implementations
 * for all `_impl_*` methods.
 */
export class NopComponent extends BaseComponent {
  // @defaultConstructor

  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }

  static _impl_configClass() {
    return BaseConfig;
  }
}

/**
 * @implements {IntfRequestHandler}
 */
class MockApp extends BaseApplication {
  static mockCalls = [];

  // @defaultConstructor

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
      const result = new FullResponse();
      result.mockInfo = callInfo;
      return result;
    } else {
      return null;
    }
  }

  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }

  static _impl_configClass() {
    return BaseConfig;
  }
}

function makeRequest(path) {
  return new IncomingRequest({
    context: new RequestContext(
      Object.freeze({ address: 'localhost', port: 12345 }),
      Object.freeze({ address: 'awayhost',  port: 54321 })),
    headers: new HttpHeaders({
      'some-header': 'something'
    }),
    protocolName: 'http-2',
    pseudoHeaders: new HttpHeaders({
      authority: 'your.host',
      method:    'get',
      path,
      scheme:    'https'
    })
  });
}

describe('constructor', () => {
  test('accepts some syntactically valid `paths`', () => {
    const paths = {
      '/':             'a',
      '/*':            'b',
      '/x':            'c',
      '/x/*':          'd',
      '/x/y/zorp':     'e',
      '/:foo:':        'f',
      '/beep/@$floop': 'g'
    };
    expect(() => new PathRouter({ name: 'x', paths })).not.toThrow();
  });

  test.each`
  path
  ${'//'}             // No empty components.
  ${'/foo//'}
  ${'/foo//bar'}
  ${'/./x'}           // No navigation components.
  ${'/x/.'}
  ${'/x/y/../z'}
  ${'/x/y/..'}
  ${'/*/x'}           // Wildcards only at end.
  ${'/a/*/x'}
  ${'/*/'}
  ${'/foo/bar?query'} // Queries not allowed.
  ${'/foo/bar#hash'}  // Fragments not allowed.
  ${'/foo/**/bar'}    // No star-only components.
  ${'/foo/a%/bar'}    // Invalid %-encoding.
  ${'/foo/b%1/bar'}
  ${'/foo/c%1z/bar'}
  ${'/foo/d%x5/bar'}
  ${'/foo/e%ab/bar'}  // (Must be uppercase hex.)
  ${'/\u{1234}'}      // Non-ASCII should be %-encoded.
  `('throws given path `$path`', ({ path }) => {
    const paths = {
      '/a': 'a',
      ...path,
      '/z': 'z'
    };
    expect(() => new PathRouter({ name: 'x', paths })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(paths, { appCount = 1, handlerFunc = null } = {}) {
    const root = new NopComponent({ name: 'root' }, new RootControlContext(null));
    await root.start();

    root.applicationManager = {
      get(name) {
        return root.context.getComponent(['application', name]);
      }
    };

    const apps = new NopComponent({ name: 'application' });
    await root._prot_addChild(apps);

    for (let i = 1; i <= appCount; i++) {
      const app = new MockApp({ name: `mockApp${i}` });
      if (handlerFunc) {
        app.mockHandler = handlerFunc;
      }
      await app.init(new ControlContext(app, apps));
      await app.start();
    }

    const pr = new PathRouter({ name: 'myRouter', paths });

    await pr.init(new ControlContext(pr, apps));
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
        const request = makeRequest(requestPath);
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
        const request = makeRequest(requestPath);
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

    const request = makeRequest('/x/y/z');
    const result  = await pr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));

    expect(result).not.toBeNull();
    expect(result.mockInfo.application.name).toBe('mockApp2');

    const callNames = MockApp.mockCalls.map(({ application }) => application.name);
    expect(callNames).toEqual(['mockApp4', 'mockApp3', 'mockApp2']);
  });

  test('matches on `dispatch.extra` (not `request.pathname`)', async () => {
    const pr      = await makeInstance({ '/florp/floop/*': 'mockApp1' });
    const request = makeRequest('/x/y/z');
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
    const request = makeRequest('/x/y/z');
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
