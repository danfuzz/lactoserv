// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MockComponent, MockRootComponent } from '@this/compy/testing';
import { DispatchInfo } from '@this/net-util';
import { PathRouter } from '@this/webapp-builtins';
import { MockApplication } from '@this/webapp-core/testing';

import { RequestUtil } from '#tests/RequestUtil';


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

  test('accepts `null` as bindings', () => {
    const paths = {
      '/':        null,
      '/*':       'yes',
      '/foo/*':   null,
      '/foo/bar': 'superYes'
    };
    expect(() => new PathRouter({ paths })).not.toThrow();
  });

  test.each`
  name
  ${undefined}
  ${false}
  ${true}
  ${123}
  ${123n}
  ${['x']}
  ${{ a: 'x' }}
  ${''}         // This and the rest are syntactically incorrect names.
  ${'-zonk'}
  ${'zonk-'}
  ${'ab$cd'}
  ${' this '}
  `('does not allow binding to `$name`', ({ name }) => {
    const paths = { '/': name };
    expect(() => new PathRouter({ paths })).toThrow();
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
  `('throws given invalid path `$path`', ({ path }) => {
    const paths = {
      '/a':   'a',
      [path]: 'pathApp',
      '/z':   'z'
    };
    expect(() => new PathRouter({ name: 'x', paths })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(paths, { appCount = 1, handlerFunc = null } = {}) {
    const root = new MockRootComponent();
    await root.start();

    root.applicationManager = {
      get(name) {
        return root.context.getComponent(['application', name]);
      }
    };

    const apps = new MockComponent({ name: 'application' });
    await root.addAll(apps);

    for (let i = 1; i <= appCount; i++) {
      const app = new MockApplication({ name: `mockApp${i}` });
      if (handlerFunc) {
        app.mockHandler = handlerFunc;
      }
      await apps.addAll(app);
    }

    const pr = new PathRouter({ name: 'myRouter', paths });

    await apps.addAll(pr);

    return pr;
  }

  describe('when dispatched to directly (as if directly from `NetworkEndpoint`)', () => {
    let pr = null;

    function extractCallInfo() {
      return MockApplication.mockCalls.map(({ application, request, dispatch }) => {
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

        MockApplication.mockCalls = [];
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
        const request = RequestUtil.makeGet(requestPath);
        const result  = await pr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

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

        MockApplication.mockCalls = [];
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
        const request = RequestUtil.makeGet(requestPath);
        const result  = await pr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

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

    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/x/y/z');
    const result  = await pr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).not.toBeNull();
    expect(result.mockInfo.application.name).toBe('mockApp2');

    const callNames = MockApplication.mockCalls.map(({ application }) => application.name);
    expect(callNames).toEqual(['mockApp4', 'mockApp3', 'mockApp2']);
  });

  test('stops trying fallbacks after it finds a `null` binding', async () => {
    const pr = await makeInstance(
      {
        '/*':     'mockApp1',
        '/x/*':   null,
        '/x/y/*': 'mockApp2'
      },
      { appCount: 2, handlerFunc: ({ application }) => application.name === 'mockApp1' }
    );

    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/x/y/z');
    const result  = await pr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));

    expect(result).toBeNull();

    const callNames = MockApplication.mockCalls.map(({ application }) => application.name);
    expect(callNames).toEqual(['mockApp2']);
  });

  test('matches on `dispatch.extra` (not `request.pathname`)', async () => {
    const pr      = await makeInstance({ '/florp/floop/*': 'mockApp1' });
    const request = RequestUtil.makeGet('/x/y/z');
    const result  = await pr.handleRequest(request,
      new DispatchInfo(PathKey.EMPTY, new PathKey(['florp', 'floop', 'bop'], false)));

    expect(result).not.toBeNull();

    const callInfo = result.mockInfo;
    expect(callInfo.application.name).toBe('mockApp1');
    expect(callInfo.request).toBe(request);
    expect(callInfo.dispatch.base.path).toEqual(['florp', 'floop']);
    expect(callInfo.dispatch.extra.path).toEqual(['bop']);
  });

  test('forms new `dispatch` by shifting items from `extra` to `base`', async () => {
    const pr      = await makeInstance({ '/zonk/*': 'mockApp1' });
    const request = RequestUtil.makeGet('/x/y/z');
    const result  = await pr.handleRequest(request,
      new DispatchInfo(
        new PathKey(['beep'], false),
        new PathKey(['zonk', 'zorch', 'florp'], false)));

    expect(result).not.toBeNull();

    const callInfo = result.mockInfo;
    expect(callInfo.application.name).toBe('mockApp1');
    expect(callInfo.request).toBe(request);
    expect(callInfo.dispatch.base.path).toEqual(['beep', 'zonk']);
    expect(callInfo.dispatch.extra.path).toEqual(['zorch', 'florp']);
  });
});
