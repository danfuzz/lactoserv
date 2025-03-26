// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { PathKey } from '@this/collections';
import { MockComponent, MockRootComponent } from '@this/compy/testing';
import { DispatchInfo, FullResponse } from '@this/net-util';
import { HostRouter } from '@this/webapp-builtins';
import { MockApplication } from '@this/webapp-core/testing';

import { RequestUtil } from '#tests/RequestUtil';


describe('constructor', () => {
  test('accepts a valid minimal configuration', () => {
    expect(() => new HostRouter({
      hosts: {}
    })).not.toThrow();
  });

  test('accepts a valid configuration with several non-wildcard hosts', () => {
    expect(() => new HostRouter({
      hosts: {
        '127.0.0.1':      'app1',
        '::1':            'app2',
        '[1234::5:abcd]': 'app2',
        'localhost':      'app3',
        'x.y.localhost':  'app3'
      }
    })).not.toThrow();
  });

  test('accepts a valid configuration with several wildcard hosts', () => {
    expect(() => new HostRouter({
      hosts: {
        '*':            'app1',
        '*.florp':      'app2',
        '*.florp.like': 'app3'
      }
    })).not.toThrow();
  });

  test('accepts a valid omnibus configuration', () => {
    expect(() => new HostRouter({
      hosts: {
        '*':             'app1',
        '*.org':         'app1',
        '*.example.com': 'app2',
        'beep.boop':     'app2',
        '10.0.0.123':    'app2',
        '0:0::1':        'app3',
        '1234:abcd::98': 'app3'
      }
    })).not.toThrow();
  });

  test('does not allow two names that differ only in case', () => {
    expect(() => new HostRouter({
      hosts: {
        'Boop.bop': 'app1',
        'booP.bop': 'app2'
      }
    })).toThrow();

    expect(() => new HostRouter({
      hosts: {
        '*.ZONK': 'app1',
        '*.ZoNK': 'app2'
      }
    })).toThrow();
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
    const hosts = { '*': name };
    expect(() => new HostRouter({ hosts })).toThrow();
  });

  test.each`
  host
  ${''}                  // No empty host string.
  ${'foo.*'}             // No wildcard at the end.
  ${'foo.*.bar'}         // No wildcard in the middle.
  ${'*.123.45'}          // No wildcard in an IPv4 address.
  ${'*:1::2'}            // No wildcard in an IPv6 address.
  ${'*foo.bar'}          // Wildcard must be its own component.
  ${'1.2.3'}             // Too few components for an IPv4 address.
  ${'1.2'}
  ${'123'}
  ${'1.2.3.4.5'}         // Too many components for an IPv4 address.
  ${'abcd::ghij'}        // Invalid characters for IPv6 address.
  ${'0:1:2:3:4:5:6'}     // Too few components for an IPv6 address.
  ${'0:1:2:3:4:5'}
  ${'0:1:2:3:4'}
  ${'0:1:2:3'}
  ${'0:1:2'}
  ${'0:1'}
  ${'0:1:2:3:4:5:6:7:8'} // Too many components for an IPv6 address.
  ${'0:1:2:3:4::5:6:7:8'}
  ${'0:1:2:3:4::5:6:7'}
  ${'0::1::2'}           // Too many double-colons for an IPv6 address.
  ${'123:::456:7'}       // Triple-colon is not allowed in an IPv6 address.
  ${'foo.bar:123'}       // Port not allowed.
  ${'127.0.0.1:8443'}
  ${'[12::34]:123'}
  ${'ab#cd.e.f'}         // Invalid character for DNS name.
  `('throws given invalid host `$host`', ({ host }) => {
    const hosts = {
      a:      'a',
      [host]: 'hostApp',
      z:      'z'
    };
    expect(() => new HostRouter({ hosts })).toThrow();
  });
});

describe('_impl_handleRequest()', () => {
  async function makeInstance(opts, { appCount = 1, handlerFunc = null } = {}) {
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

    const hr = new HostRouter({ name: 'myRouter', ...opts });

    await apps.addAll(hr);

    return hr;
  }

  async function expectApp(hr, host, appName, expectResponse = true) {
    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/x/y', host);
    const result  = await hr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    if (expectResponse) {
      expect(result).toBeInstanceOf(FullResponse);
    } else {
      expect(result).toBeNull();
    }

    const calls = MockApplication.mockCalls;
    expect(calls.length).toBe(1);
    expect(calls[0].application.name).toBe(appName);
  }

  async function expectNull(hr, host) {
    MockApplication.mockCalls = [];

    const request = RequestUtil.makeGet('/x/y', host);
    const result  = await hr.handleRequest(request, new DispatchInfo(PathKey.EMPTY, request.pathname));
    expect(result).toBeNull();

    const calls = MockApplication.mockCalls;
    expect(calls).toEqual([]);
  }

  beforeEach(() => {
    MockApplication.mockCalls = [];
  });

  test('routes to an exact-match IPv4 address', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '127.0.0.1': 'mockApp1',
          '127.0.0.2': 'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, '127.0.0.1', 'mockApp1');
  });

  test('routes to an exact-match IPv6 address', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '1234::5678:abc': 'mockApp1',
          '::abc':          'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, '1234::5678:abc', 'mockApp1');
  });

  test('canonicalizes the IPv6 address in the route table', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '0034::0:0:00ab:cd': 'mockApp1'
        }
      }
    );

    await expectApp(hr, '34::ab:cd', 'mockApp1');
  });

  test('routes to an exact-match DNS name', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          'splat':             'mockApp2',
          'zorch.splat':       'mockApp1',
          'blurp.zorch.splat': 'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, 'zorch.splat', 'mockApp1');
  });

  test('routes to a case-folded DNS name', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          'splat':             'mockApp2',
          'ZORCH.splat':       'mockApp1',
          'blurp.zorch.splat': 'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, 'zorch.SPLAT', 'mockApp1');
  });

  test('routes to a matching case-folded DNS name and not a wildcard', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          'splat':       'mockApp2',
          'ZORCH.splat': 'mockApp1',
          '*.splat':     'mockApp2',
          '*':           'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, 'zorCH.splAT', 'mockApp1');
  });

  test('does not route to an exact-match DNS name as if it were a wildcard', async () => {
    const hr = await makeInstance({
      hosts: {
        'zorch.splat': 'mockApp1'
      }
    });

    await expectNull(hr, 'foo.zorch.splat');
  });

  test('routes to a just-wildcard name from anything not listed', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '*':     'mockApp1',
          'zorch': 'mockApp2'
        }
      },
      { appCount: 2 }
    );

    await expectApp(hr, 'florp',    'mockApp1');
    await expectApp(hr, '10.0.0.2', 'mockApp1');
    await expectApp(hr, '123::abc', 'mockApp1');
    await expectApp(hr, 'zorch',    'mockApp2');
  });

  test('routes to a wildcard DNS name from the base name and anything under it not covered by another entry', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '*.zonk':       'mockApp1',
          'beep.zonk':    'mockApp2',
          '*.x.y.z.zonk': 'mockApp3',
          'zorch':        'mockApp4'
        }
      },
      { appCount: 4 }
    );

    await expectApp(hr, 'zonk',            'mockApp1');
    await expectApp(hr, 'bonk.zonk',       'mockApp1');
    await expectApp(hr, 'a.b.c.zonk',      'mockApp1');
    await expectApp(hr, 'beep.zonk',       'mockApp2');
    await expectApp(hr, 'blorp.beep.zonk', 'mockApp1');
    await expectApp(hr, 'x.y.z.zonk',      'mockApp3');
    await expectApp(hr, 'abc.x.y.z.zonk',  'mockApp3');
  });

  test('does not do fallback', async () => {
    const hr = await makeInstance(
      {
        hosts: {
          '*':         'mockApp1',
          '*.zonk':    'mockApp2',
          'beep.zonk': 'mockApp3',
          '12.3.4.5':  'mockApp4'
        }
      },
      {
        appCount: 4,
        handlerFunc: () => false
      }
    );

    await expectApp(hr, 'beep.zonk', 'mockApp3', false);
    await expectApp(hr, 'flump.zonk', 'mockApp2', false);
    await expectApp(hr, '12.3.4.5', 'mockApp4', false);
  });
});
