// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MockComponent, RootControlContext } from '@this/compy';
import { DispatchInfo, FullResponse } from '@this/net-util';
import { SuffixRouter } from '@this/webapp-builtins';

import { MockApp } from '#test/MockApp';
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

  test('rejects both `handle*` being `false`', () => {
    const opts = {
      suffixes:          { '*': 'a' },
      handleDirectories: false,
      handleFiles:       false
    };

    expect(() => new SuffixRouter(opts)).toThrow();
  });

  test.each`
  opts
  ${{ handleDirectories: false, handleFiles: true }}
  ${{ handleDirectories: true,  handleFiles: false }}
  ${{ handleDirectories: true,  handleFiles: true }}
  `('accepts $opts', ({ opts }) => {
    opts = { ...opts, suffixes: { '*': 'a' } };
    expect(() => new SuffixRouter(opts)).not.toThrow();
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
    const root = new MockComponent({ name: 'root' }, new RootControlContext(null));
    await root.start();

    root.applicationManager = {
      get(name) {
        return root.context.getComponent(['application', name]);
      }
    };

    const apps = new MockComponent({ name: 'application' });
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

  async function expectApp(sr, path, appName, expectResponse = true) {
    MockApp.mockCalls = [];

    const request = RequestUtil.makeGet(path);
    const result  = await sr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    if (expectResponse) {
      expect(result).toBeInstanceOf(FullResponse);
    } else {
      expect(result).toBeNull();
    }

    const calls = MockApp.mockCalls;
    expect(calls.length).toBe(1);
    expect(calls[0].application.name).toBe(appName);
  }

  async function expectNull(sr, path) {
    MockApp.mockCalls = [];

    const request = RequestUtil.makeGet(path);
    const result  = await sr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    expect(result).toBeNull();

    const calls = MockApp.mockCalls;
    expect(calls).toEqual([]);
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

    await expectApp(sr, '/boop.beep',       'mockApp1');
    await expectApp(sr, '/zonk/florp.beep', 'mockApp1');
  });

  test('handles directory paths when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       false,
      suffixes: {
        '*.beep': 'mockApp1'
      }
    });

    await expectApp(sr, '/boop.beep/',       'mockApp1');
    await expectApp(sr, '/zonk/florp.beep/', 'mockApp1');
  });

  test('handles both directories and files when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       true,
      suffixes: {
        '*.xyz': 'mockApp1'
      }
    });

    await expectApp(sr, '/abc.xyz',       'mockApp1');
    await expectApp(sr, '/zonk/pdq.xyz',  'mockApp1');
    await expectApp(sr, '/abc.xyz/',      'mockApp1');
    await expectApp(sr, '/zonk/pdq.xyz/', 'mockApp1');
  });

  test('does not handle files when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: true,
      handleFiles:       false,
      suffixes: {
        '*.oof': 'mockApp1'
      }
    });

    await expectNull(sr, '/boop.oof');
    await expectNull(sr, '/zonk/florp.oof');
  });

  test('does not handle directories when so configured', async () => {
    const sr = await makeInstance({
      handleDirectories: false,
      handleFiles:       true,
      suffixes: {
        '*.oof': 'mockApp1'
      }
    });

    await expectNull(sr, '/boop.oof/');
    await expectNull(sr, '/zonk/florp.oof/');
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

    await expectApp(sr, '/boop.bop',   'mockApp1');
    await expectApp(sr, '/zonk',       'mockApp1');
    await expectApp(sr, '/a/b/c/zonk', 'mockApp1');
    await expectApp(sr, '/.bleep',     'mockApp1');
    await expectApp(sr, '/bleepy',     'mockApp1');
  });

  test('returns `null` when no suffix matches and there is no full-wildcard', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*.x':     'mockApp1',
        '*.blorp': 'mockApp1'
      }
    });

    await expectNull(sr, '/boop.bop');
    await expectNull(sr, '/floop/flop');
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

    await expectApp(sr, '/zippity.beep-bop', 'mockApp1');
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

    await expectApp(sr, '/x/y/z.suf1',       'mockApp1');
    await expectApp(sr, '/stuff.yes2',       'mockApp2');
    await expectApp(sr, '/flip/flop-whee3',  'mockApp3');
    await expectApp(sr, '/zyx/zip_florp4',   'mockApp4');
    await expectApp(sr, '/ab/cd/ef/gh+num5', 'mockApp5');
  });

  test('does not treat a just-a-suffix file name (no prefix) as a match', async () => {
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*.zorch': 'mockApp1'
      }
    });

    await expectNull(sr, '/.zorch');
    await expectNull(sr, '/x/.zorch');
    await expectNull(sr, '/bip/bop/.zorch');
    await expectNull(sr, '/flip/flop/floop/.zorch');
  });

  test('does not do fallback to less-specific matches', async () => {
    const handlerFunc = ({ application }) => application.name !== 'mockApp4';
    const sr = await makeInstance({
      handleFiles: true,
      suffixes: {
        '*':       'mockApp1',
        '*.z':     'mockApp2',
        '*.y.z':   'mockApp3',
        '*.x.y.z': 'mockApp4'
      }
    }, { appCount: 4, handlerFunc });

    await expectApp(sr, '/a/b/c/dee.x.y.z', 'mockApp4', false);
  });
});
