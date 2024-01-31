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

describe('.nameKey', () => {
  test.each`
  name                        | parts
  ${'x'}                      | ${['x']}
  ${'x.y'}                    | ${['y', 'x']}
  ${'x.y.z'}                  | ${['z', 'y', 'x']}
  ${'blorp.zorch.flap.floop'} | ${['floop', 'flap', 'zorch', 'blorp']}
  ${'10.1.4.255'}             | ${['10.1.4.255']}
  ${'127.0.0.1'}              | ${['127.0.0.1']}
  ${'::1'}                    | ${['::1']}
  ${'1:2:3:4:a:b:c:d'}        | ${['1:2:3:4:a:b:c:d']}
  `('gets key with expected parts, given name $name', ({ name, parts }) => {
    const hi  = new HostInfo(name, 123);
    const key = hi.nameKey;

    expect(key).toBeInstanceOf(TreePathKey);
    expect(key.wildcard).toBeFalse();
    expect(key.path).toBeArrayOfSize(parts.length);
    expect(key.path).toEqual(parts);
  });
});

describe('.nameString', () => {
  test('gets the name that was passed in the constructor', () => {
    const name = 'floop.florp';
    const hi   = new HostInfo(name, 123);

    expect(hi.nameString).toBe(name);
  });
});

describe('.namePortString', () => {
  test('gets the name and port that were passed in the constructor', () => {
    const name = 'floop.florp';
    const hi   = new HostInfo(name, 123);

    expect(hi.namePortString).toBe('floop.florp:123');
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

describe('getNamePortString()', () => {
  test('does not skip the port if it does not match', () => {
    const name = 'bonk.boop';
    const hi   = new HostInfo(name, 111);

    expect(hi.getNamePortString(9)).toBe('bonk.boop:111');
  });

  test('does not skip the port if `localPort` is not passed', () => {
    const name = 'bonk.boop';
    const hi   = new HostInfo(name, 111);

    expect(hi.getNamePortString()).toBe('bonk.boop:111');
  });

  test('skips the port if it matches', () => {
    const name = 'bonk.boop';
    const hi   = new HostInfo(name, 111);

    expect(hi.getNamePortString(111)).toBe('bonk.boop');
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
  port
  ${80}
  ${123}
  ${443}
  `('for $port', ({ port }) => {
    test('constructs an instance with name `localhost`', () => {
      const hi = HostInfo.localhostInstance(port);
      expect(hi.nameString).toBe('localhost');
    });

    test('constructs an instance with the expected port', () => {
      const hi = HostInfo.localhostInstance(port);
      expect(hi.portNumber).toBe(port);
      expect(hi.portString).toBe(port.toString());
    });
  });
});

describe.each`
methodName                 | onError
${'parseHostHeader'}       | ${'throws'}
${'parseHostHeaderOrNull'} | ${'null'}
${'safeParseHostHeader'}   | ${'localhost'}
`('$methodName', ({ methodName, onError }) => {
  // Type failure cases. These should throw even in the "safe" versions.
  test.each`
  port         | host
  ${true}      | ${'x'}
  ${'xyz'}     | ${'x'}
  ${['boop']}  | ${'x'}
  ${new Map()} | ${'x'}
  ${'x'}       | ${null}
  ${'x'}       | ${undefined}
  ${'x'}       | ${true}
  ${'x'}       | ${123}
  ${'x'}       | ${['boop']}
  ${'x'}       | ${new Map()}
  `('throws given ($host, $port)', ({ host, port }) => {
    expect(() => HostInfo[methodName](host, port)).toThrow();
  });

  // Syntactically incorrect host strings. These either throw or return
  // something, depending on which method is being used.
  test.each`
  host
  ${''}
  ${'@'}
  ${'[]'}
  ${'[123]'}
  ${'[1:2:3:4:5:6:7:8:9]'}
  ${'1..2'}
  ${'1.2.3.4.5'}
  ${'foo..bar'}
  ${'foo:'}
  ${'a:b'}
  ${'foo.boop:-1'}
  ${'foo:123x'}
  `('fails in the expected manner for host $host', ({ host }) => {
    const doParse = () => HostInfo[methodName](host, 443);

    switch (onError) {
      case 'localhost': {
        const hi = doParse();
        expect(hi.nameString).toBe('localhost');
        expect(hi.portNumber).toBe(443);
        break;
      }
      case 'null': {
        expect(doParse()).toBeNull();
        break;
      }
      case 'throws': {
        expect(doParse).toThrow();
        break;
      }
    }
  });

  // Success cases
  test.each`
  localPort | host                      | name                 | port
  ${80}     | ${'x'}                    | ${'x'}               | ${80}
  ${123}    | ${'x'}                    | ${'x'}               | ${123}
  ${443}    | ${'x'}                    | ${'x'}               | ${443}
  ${6}      | ${'x:8080'}               | ${'x'}               | ${8080}
  ${7}      | ${'x:443'}                | ${'x'}               | ${443}
  ${8}      | ${'x:8443'}               | ${'x'}               | ${8443}
  ${9}      | ${'x:80'}                 | ${'x'}               | ${80}
  ${10}     | ${'zoop.boop.floop'}      | ${'zoop.boop.floop'} | ${10}
  ${11}     | ${'zoop.boop.floop:9999'} | ${'zoop.boop.floop'} | ${9999}
  ${12}     | ${'192.168.55.66'}        | ${'192.168.55.66'}   | ${12}
  ${13}     | ${'192.168.55.66:60001'}  | ${'192.168.55.66'}   | ${60001}
  ${14}     | ${'[a:b::c:d]'}           | ${'a:b::c:d'}        | ${14}
  ${15}     | ${'[a:b::c:d]:0'}         | ${'a:b::c:d'}        | ${0}
  ${16}     | ${'[1:2::0:0:345]'}       | ${'1:2::345'}        | ${16}
  `('works for $host (local port $localPort)', ({ localPort, host, name, port }) => {
    const hi = HostInfo[methodName](host, localPort);
    expect(hi.nameString).toBe(name);
    expect(hi.portNumber).toBe(port);
  });

  test('accepts a valid port number string', () => {
    expect(() => new HostInfo('host', '123')).not.toThrow();
  });
});
