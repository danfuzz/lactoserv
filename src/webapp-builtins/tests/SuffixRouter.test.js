// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { RootControlContext } from '@this/compy';
import { DispatchInfo, FullResponse } from '@this/net-util';
import { SuffixRouter } from '@this/webapp-builtins';

import { MockApp } from '#test/MockApp';
import { NopComponent } from '#test/NopComponent';
import { RequestUtil } from '#test/RequestUtil';


describe('constructor', () => {
  test('accepts some syntactically valid `suffixes`', () => {
    const suffixes = {
      '*':         'a',
      '*.w':       'b',
      '*-x':       'c',
      '*_y':       'd',
      '*+z':       'e',
      '*.x.y':     'f',
      '*.foo-bar': 'g',
      '*._bonk':   'h'
    };
    expect(() => new SuffixRouter({ name: 'x', suffixes })).not.toThrow();
  });

  test.each`
  suffix
  ${''}        // Can't be totally empty.
  ${'.xyz'}    // Must start with a star.
  ${'x.*'}
  ${'y.*.z'}
  ${'*X'}      // Cannot use alphanumeric immediately after star.
  ${'*x'}
  ${'*0'}
  ${'*x'}
  ${'*.x.*.y'} // No extra stars.
  ${'*-a$b'}   // Just alphanumerics and the couple special chars in the suffix.
  ${'*.a:b'}
  ${'*.a@b'}
  ${'*.a%12b'}
  ${'*.a\u{1234}b'}
  `('throws given suffix spec `$suffix`', ({ suffix }) => {
    const suffixes = {
      '*.beep': 'a',
      ...{ suffix },
      '*.boop': 'z'
    };
    expect(() => new SuffixRouter({ name: 'x', suffixes })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(opts, { appCount = 1, handlerFunc = null } = {}) {
    const root = new NopComponent({ name: 'root' }, new RootControlContext(null));
    await root.start();

    root.applicationManager = {
      get(name) {
        return root.context.getComponent(['application', name]);
      }
    };

    const apps = new NopComponent({ name: 'application' });
    await root.addChildren(apps);

    for (let i = 1; i <= appCount; i++) {
      const app = new MockApp({ name: `mockApp${i}` });
      if (handlerFunc) {
        app.mockHandler = handlerFunc;
      }
      await apps.addChildren(app);
    }

    const sr = new SuffixRouter({ name: 'myRouter', ...opts });

    await apps.addChildren(sr);

    return sr;
  }

  beforeEach(() => {
    MockApp.mockCalls = [];
  });

  test('handles regular file (non-directory) paths by default', async () => {
    const sr = await makeInstance({ suffixes: {} });

    expect(sr.config.handleFiles).toBeTrue();
  });

  test('does not handle directory paths by default', async () => {
    const sr = await makeInstance({ suffixes: {} });

    expect(sr.config.handleDirectories).toBeFalse();
  });

  test('handles regular file (non-directory) paths when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: false,
      handleFiles:       true,
      suffixes: {
        '*.beep': 'mockApp1'
      }
    });

    const request1 = RequestUtil.makeGet('/boop.beep');
    const result1  = await sr.handleRequest(request1, new DispatchInfo(TreePathKey.EMPTY, request1.pathname));
    expect(result1).toBeInstanceOf(FullResponse);

    const request2 = RequestUtil.makeGet('/zonk/florp.beep');
    const result2  = await sr.handleRequest(request2, new DispatchInfo(TreePathKey.EMPTY, request2.pathname));
    expect(result2).toBeInstanceOf(FullResponse);
  });

  test('handles directory paths when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       false,
      suffixes: {
        '*.beep': 'mockApp1'
      }
    });

    const request1 = RequestUtil.makeGet('/boop.beep/');
    const result1  = await sr.handleRequest(request1, new DispatchInfo(TreePathKey.EMPTY, request1.pathname));
    expect(result1).toBeInstanceOf(FullResponse);

    const request2 = RequestUtil.makeGet('/zonk/florp.beep/');
    const result2  = await sr.handleRequest(request2, new DispatchInfo(TreePathKey.EMPTY, request2.pathname));
    expect(result2).toBeInstanceOf(FullResponse);
  });

  test('handles both directories and files when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       true,
      suffixes: {
        '*.xyz': 'mockApp1'
      }
    });

    const request1 = RequestUtil.makeGet('/abc.xyz');
    const result1  = await sr.handleRequest(request1, new DispatchInfo(TreePathKey.EMPTY, request1.pathname));
    expect(result1).toBeInstanceOf(FullResponse);

    const request2 = RequestUtil.makeGet('/zonk/pdq.xyz/');
    const result2  = await sr.handleRequest(request2, new DispatchInfo(TreePathKey.EMPTY, request2.pathname));
    expect(result2).toBeInstanceOf(FullResponse);
  });

  test('does not handle files when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       false,
      suffixes: {
        '*.oof': 'mockApp1'
      }
    });

    const request1 = RequestUtil.makeGet('/boop.oof');
    const result1  = await sr.handleRequest(request1, new DispatchInfo(TreePathKey.EMPTY, request1.pathname));
    expect(result1).toBeNull();

    const request2 = RequestUtil.makeGet('/zonk/florp.oof');
    const result2  = await sr.handleRequest(request2, new DispatchInfo(TreePathKey.EMPTY, request2.pathname));
    expect(result2).toBeNull();
  });

  test('does not handle directories when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: false,
      handleFiles:       true,
      suffixes: {
        '*.oof': 'mockApp1'
      }
    });

    const request1 = RequestUtil.makeGet('/boop.oof/');
    const result1  = await sr.handleRequest(request1, new DispatchInfo(TreePathKey.EMPTY, request1.pathname));
    expect(result1).toBeNull();

    const request2 = RequestUtil.makeGet('/zonk/florp.oof/');
    const result2  = await sr.handleRequest(request2, new DispatchInfo(TreePathKey.EMPTY, request2.pathname));
    expect(result2).toBeNull();
  });

  test('routes to the full-wildcard when no other suffix matches', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*':       'mockApp1',
        '*.x':     'mockApp2',
        '*.blorp': 'mockApp2'
      }
    }, { appCount: 2 });

    const request = RequestUtil.makeGet('/boop.bop');
    const result  = await sr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));
    expect(result).toBeInstanceOf(FullResponse);
    expect(MockApp.mockCalls[0].application.name).toBe('mockApp1');
  });

  test('returns `null` when no suffix matches and there is no full-wildcard', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*.x':     'mockApp1',
        '*.blorp': 'mockApp1'
      }
    });

    const request = RequestUtil.makeGet('/boop.bop');
    const result  = await sr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));
    expect(result).toBeNull();
  });

  test('routes to the longest matching suffix when more than one matches', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*':          'mockApp2',
        '*.beep':     'mockApp2',
        '*.beep-bop': 'mockApp1',
        '*-bop':      'mockApp2',
        '*.bop':      'mockApp2'
      }
    }, { appCount: 2 });

    const request = RequestUtil.makeGet('/zippity.beep-bop');
    const result  = await sr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));
    expect(result).toBeInstanceOf(FullResponse);
    expect(MockApp.mockCalls[0].application.name).toBe('mockApp1');
  });

  test('routes to different apps depending on suffix', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*.suf1':   'mockApp1',
        '*.yes2':   'mockApp2',
        '*-whee3':  'mockApp3',
        '*_florp4': 'mockApp4',
        '*+num5':   'mockApp5'
      }
    }, { appCount: 5 });

    async function doOne(path, app) {
      MockApp.mockCalls = [];

      const request = RequestUtil.makeGet(path);
      const result  = await sr.handleRequest(request, new DispatchInfo(TreePathKey.EMPTY, request.pathname));
      expect(result).toBeInstanceOf(FullResponse);
      expect(MockApp.mockCalls[0].application.name).toBe(app);
    }

    await doOne('/x/y/z.suf1',       'mockApp1');
    await doOne('/stuff.yes2',       'mockApp2');
    await doOne('/flip/flop-whee3',  'mockApp3');
    await doOne('/zyx/zip_florp4',   'mockApp4');
    await doOne('/ab/cd/ef/gh+num5', 'mockApp5');
  });
});
