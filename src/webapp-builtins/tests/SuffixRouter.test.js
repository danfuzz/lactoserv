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
});
