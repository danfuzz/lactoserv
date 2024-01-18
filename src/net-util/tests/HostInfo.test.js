// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { TreePathKey } from '@this/collections';
import { HostInfo } from '@this/net-util';


describe('constructor', () => {
  // Failure cases for name argument.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${1}
  ${['x']}
  ${''}
  `('fails when passing name as $arg', ({ arg }) => {
    expect(() => new HostInfo(arg, 123)).toThrow();
  });

  // Failure cases for port argument.
  test.each`
  arg
  ${undefined}
  ${null}
  ${false}
  ${''}
  ${'x'}
  ${'!'}
  ${['x']}
  ${-1}
  ${0.5}
  ${65535.9}
  ${65536}
  `('fails when passing port as $arg', ({ arg }) => {
    expect(() => new HostInfo('host', arg)).toThrow();
  });

  test('accepts a valid port number string', () => {
    expect(() => new HostInfo('host', '123')).not.toThrow();
  });
});

// TODO: nameKey

describe('.nameString', () => {
  test('gets the name that was passed in the constructor', () => {
    const name = 'floop.florp';
    const hi   = new HostInfo(name, 123);

    expect(hi.nameString).toBe(name);
  });
});

describe('.portNumber', () => {
  test('gets the port number-per-se that was passed in the constructor', () => {
    const port = 5432;
    const hi   = new HostInfo('host', port);

    expect(hi.portNumber).toBe(port);
  });

  test('gets the parsed port number-as-string that was passed in the constructor', () => {
    const port = 7771;
    const hi   = new HostInfo('host', port.toString());

    expect(hi.portNumber).toBe(port);
  });
});

describe('.portString', () => {
  test('gets the string form of the port number-per-se that was passed in the constructor', () => {
    const port = 99;
    const hi   = new HostInfo('host', port);

    expect(hi.portString).toBe(port.toString());
  });

  test('gets the port number-as-string that was passed in the constructor', () => {
    const port = '8001';
    const hi   = new HostInfo('host', port);

    expect(hi.portString).toBe(port);
  });
});

describe('nameIsIpAddress()', () => {
  test('returns `true` given an IPv4 address for the name', () => {
    const hi = new HostInfo('1.2.3.4', 123);
    expect(hi.nameIsIpAddress()).toBeTrue();
  });

  test('returns `true` given an IPv6 address for the name', () => {
    const hi = new HostInfo('[1234:abcd::ef]', 123);
    expect(hi.nameIsIpAddress()).toBeTrue();
  });

  // Various `false` cases.
  test.each`
  arg
  ${'a'}
  ${'floop'}
  ${'x.y'}
  ${'12.x'}
  ${'x.12'}
  ${'x.12.y'}
  `('returns `false` given the name $arg', ({ arg }) => {
    const hi = new HostInfo(arg, 123);
    expect(hi.nameIsIpAddress()).toBeFalse();
  });
});

describe('localhostInstance()', () => {
  describe.each`
  protocol   | port
  ${'http'}  | ${80}
  ${'https'} | ${443}
  ${'http2'} | ${443}
  `('for protocol $protocol (port $port)', ({ protocol, port }) => {
    test('constructs an instance with name `localhost`', () => {
      const hi = HostInfo.localhostInstance(protocol);
      expect(hi.nameString).toBe('localhost');
    });

    test('constructs an instance with the expected port', () => {
      const hi = HostInfo.localhostInstance(protocol);
      expect(hi.portNumber).toBe(port);
      expect(hi.portString).toBe(port.toString());
    });
  });
});

// TODO: parseHostHeader
// TODO: safeParseHostHeader
