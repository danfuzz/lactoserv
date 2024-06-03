// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { HostRouter } from '@this/webapp-builtins';


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
