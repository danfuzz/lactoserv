// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { InterfaceAddress } from '@this/net-util';


describe('constructor', () => {
  // Failure cases for address argument.
  test.each`
  arg
  ${undefined}
  ${false}
  ${1}
  ${['x']}
  ${''}
  ${'999.88.7.6'}
  ${'[127.0.0.1]'}
  ${'z::1234'}
  ${'[z::1234]'}
  ${'999.88.7.6:9'}
  ${'[127.0.0.1]:8'}
  ${'z::1234:7'}
  ${'[z::1234]:6'}
  ${{}}
  ${{ address: 9876 }}
  ${{ address: '1.2.3.4', portNumber: '*' }}
  ${{ address: '1.2.3.4', portNumber: '77' }}
  ${{ address: '1.2.3.4', portNumber: 'x' }}
  ${{ address: '1.2.3.4', portNumber: -1 }}
  ${{ address: '1.2.3.4', portNumber: 65536 }}
  ${{ fd: 12345, portNumber: '*' }}
  ${{ fd: 12345, portNumber: '77' }}
  ${{ fd: 12345, portNumber: 'x' }}
  ${{ fd: 12345, portNumber: -1 }}
  ${{ fd: 12345, portNumber: 65536 }}
  ${{ address: '1.2.3.4', fd: 123 }} // Can't have both.

  // Extra properties.
  ${{ fd: 123, port: 999 }} // 'port' is not correct; portNumber' is valid.
  ${{ fd: 123, boop: 999 }}
  ${{ address: 'a.b', zonk: 'x' }}
  ${{ address: '1.2.3.4', a: 1, b: 2, c: 3 }}

  // Valid addresses but missing the port.
  ${'foo'}
  ${'foo:'}
  ${'foo.bar'}
  ${'foo.bar:'}
  ${'10.0.2.3'}
  ${'10.0.2.3:'}
  ${'[abc::123]'}
  ${'[abc::123]:'}
  ${{ address: '10.1.2.3' }}

  // Invalid port.
  ${'1.2.3.4:'}
  ${'1.2.3.4:x'}
  ${'1.2.3.4:-1'}
  ${'1.2.3.4:65536'}
  ${'1.2.3.4:'}
  ${'1.2.3.4:x'}
  ${'1.2.3.4:-1'}
  ${'[1::2]:'}
  ${'[1::2]:abc'}
  ${'[1::2]:-0'}
  ${'[1::2]:65536'}
  `('fails when passing `fullAddress` as $arg', ({ arg }) => {
    expect(() => new InterfaceAddress(arg)).toThrow();
  });

  test('accepts the wildcard address', () => {
    expect(() => new InterfaceAddress('*:1')).not.toThrow();
    expect(() => new InterfaceAddress({ address: '*', portNumber: 2 })).not.toThrow();
  });

  test('accepts a valid IPv4 address', () => {
    expect(() => new InterfaceAddress('10.0.0.255:123')).not.toThrow();
    expect(() => new InterfaceAddress({ address: '10.0.0.255', portNumber: 123 })).not.toThrow();
  });

  test('accepts a valid IPv6 address', () => {
    expect(() => new InterfaceAddress('[12::34]:567')).not.toThrow();
    expect(() => new InterfaceAddress({ address: '[12::34]', portNumber: 567 })).not.toThrow();
    expect(() => new InterfaceAddress({ address: '12::34', portNumber: 567 })).not.toThrow();
  });

  test('accepts a valid FD without a port', () => {
    expect(() => new InterfaceAddress('/dev/fd/777')).not.toThrow();
    expect(() => new InterfaceAddress({ fd: 777 })).not.toThrow();
  });

  test('accepts a valid FD with a port', () => {
    expect(() => new InterfaceAddress('/dev/fd/777:654')).not.toThrow();
    expect(() => new InterfaceAddress({ fd: 777, portNumber: 654 })).not.toThrow();
  });
});

describe('.address', () => {
  test('is the constructed IP address if it was already canonical', () => {
    const ia1 = new InterfaceAddress('121.134.56.78:999');
    const ia2 = new InterfaceAddress({ address: '12.34.56.78', portNumber: 999 });
    const ia3 = new InterfaceAddress('[aa::bb]:999');
    const ia4 = new InterfaceAddress({ address: 'cc::dd', portNumber: 999 });

    expect(ia1.address).toBe('121.134.56.78');
    expect(ia2.address).toBe('12.34.56.78');
    expect(ia3.address).toBe('aa::bb');
    expect(ia4.address).toBe('cc::dd');
  });

  test('is the canonicalized form of the IP address if it was not canonical', () => {
    const ia1 = new InterfaceAddress('001.034.006.078:999');
    const ia2 = new InterfaceAddress({ address: '012.034.056.078', portNumber: 999 });
    const ia3 = new InterfaceAddress('[aa:0000::bb]:999');
    const ia4 = new InterfaceAddress({ address: '[cc::dd]', portNumber: 999 });

    expect(ia1.address).toBe('1.34.6.78');
    expect(ia2.address).toBe('12.34.56.78');
    expect(ia3.address).toBe('aa::bb');
    expect(ia4.address).toBe('cc::dd');
  });

  test('is the constructed hostname if it was constructed with a hostname', () => {
    const ia1 = new InterfaceAddress('bleep.bloop:111');
    const ia2 = new InterfaceAddress({ address: 'blop.glop.gleep', portNumber: 222 });

    expect(ia1.address).toBe('bleep.bloop');
    expect(ia2.address).toBe('blop.glop.gleep');
  });

  test('is the wildcard address if it was constructed with the wildcard', () => {
    const ia1 = new InterfaceAddress('*:333');
    const ia2 = new InterfaceAddress({ address: '*', portNumber: 456 });

    expect(ia1.address).toBe('*');
    expect(ia2.address).toBe('*');
  });

  test('is `null` if constructed with no `address`', () => {
    const ia1 = new InterfaceAddress('/dev/fd/5');
    const ia2 = new InterfaceAddress({ fd: 5 });

    expect(ia1.address).toBeNull();
    expect(ia2.address).toBeNull();
  });
});

describe('.fd', () => {
  test('is the number passed in the constructor', () => {
    const ia1 = new InterfaceAddress('/dev/fd/440');
    const ia2 = new InterfaceAddress({ fd: 441 });

    expect(ia1.fd).toBe(440);
    expect(ia2.fd).toBe(441);
  });

  test('is `null` if constructed with no `fd`', () => {
    const ia1 = new InterfaceAddress('1.3.4.1:99');
    const ia2 = new InterfaceAddress({ address: '[99::aa]', portNumber: 986 });

    expect(ia1.fd).toBeNull();
    expect(ia2.fd).toBeNull();
  });
});

describe('.portNumber', () => {
  test('is the number passed in the constructor', () => {
    const ia1 = new InterfaceAddress('12.34.56.78:999');
    const ia2 = new InterfaceAddress({ address: '12.34.56.78', portNumber: 888 });

    expect(ia1.portNumber).toBe(999);
    expect(ia2.portNumber).toBe(888);
  });

  test('is `null` if constructed with no `portNumber`', () => {
    const ia1 = new InterfaceAddress('/dev/fd/5');
    const ia2 = new InterfaceAddress({ fd: 5 });

    expect(ia1.portNumber).toBeNull();
    expect(ia2.portNumber).toBeNull();
  });
});

describe('toString()', () => {
  // Success cases that are given in canonical string form.
  test.each`
  address
  ${'10.0.0.1:123'}
  ${'[aa:bb::ff]:1'}
  ${'a.b.c:333'}
  ${'/dev/fd/98'}
  ${'/dev/fd/98:765'}
  `('succeeds for $address', ({ address }) => {
    const ia = new InterfaceAddress(address);
    expect(ia.toString()).toBe(address);
  });

  // Success cases that are given in canonical plain-object form. Note that in
  // plain-object form, the non-bracketed IPv6 syntax is canonical, even though
  // the bracketed syntax is required in the full-string form. (Yes, a little
  // confusing.)
  test.each`
  address                  | fd      | portNumber
  ${'10.0.0.1'}            | ${null} | ${77}
  ${'123:456:789::abcd'}   | ${null} | ${55}
  ${'foo.zonk'}            | ${null} | ${44}
  ${null}                  | ${123}  | ${33}
  ${null}                  | ${321}  | ${null}
  `('succeeds for ($address, $fd, $portNumber)', ({ address, fd, portNumber }) => {
    const ia = new InterfaceAddress({ address, fd, portNumber });

    if (/:/.test(address)) {
      // See comment at top of test case.
      address = `[${address}]`;
    }

    const portStr  = portNumber ? `:${portNumber}` : '';
    const expected = address
      ? `${address}${portStr}`
      : `/dev/fd/${fd}${portStr}`;

    expect(ia.toString()).toBe(expected);
  });

  // Success cases that are given in non-canonical string form.
  test.each`
  address                          | expected
  ${'010.0.0.1:09'}                | ${'10.0.0.1:9'}
  ${'[0aa:0bb:00:0::0:cdef]:012'}  | ${'[aa:bb::cdef]:12'}
  ${'bip.bop.blorp:00003'}         | ${'bip.bop.blorp:3'}
  ${'/dev/fd/099:00021'}           | ${'/dev/fd/99:21'}
  ${'/dev/fd/0071'}                | ${'/dev/fd/71'}
  `('returns `$expected` given `$address`', ({ address, expected }) => {
    const ia = new InterfaceAddress(address);
    expect(ia.toString()).toBe(expected);
  });

  // Success cases that are given in non-canonical plain-object form. (We only
  // need to check things where `address` is non-canonical, because in the
  // plain-object form, `portNumber` and `fd` can't possibly be non-canonical.)
  // In re IPv6 bracketing, the somewhat-surprising test case here is because
  // while the plain-object form treats non-bracketed as canonical, the end
  // result of `toString()` still should end up with brackets.
  test.each`
  address                  | expected
  ${'010.0.0.1'}           | ${'10.0.0.1'}
  ${'[123:456:789::abcd]'} | ${'[123:456:789::abcd]'}
  `('returns `$expected` given `$address`', ({ address, expected }) => {
    const ia = new InterfaceAddress({ address, portNumber: 8877 });
    expect(ia.toString()).toBe(`${expected}:8877`);
  });
});


//
// Static members
//

describe('parseInterface()', () => {
  // Note: Other tests check a lot of the code that's used by this method, so
  // it's not really necessary to be super-exhaustive here.

  // Failure cases.
  test.each`
  label                                 | mount
  ${'null'}                             | ${null}
  ${'non-string'}                       | ${123}
  ${'empty string'}                     | ${''}
  ${'just colon'}                       | ${':'}
  ${'missing address'}                  | ${':123'}
  ${'IPv4 with colon but missing port'} | ${'10.0.0.120:'}
  ${'IPv6 with colon but missing port'} | ${'[::1234]:'}
  ${'IPv4 missing colon and port'}      | ${'10.0.0.120'}
  ${'IPv6 missing colon and port'}      | ${'[ab::1234:45:123]'}
  ${'IPv4 port too large'}              | ${'192.168.0.33:65536'}
  ${'IPv4 port way too large'}          | ${'192.168.0.33:123456789'}
  ${'IPv6 port too large'}              | ${'[a:b::c:d]:65536'}
  ${'IPv6 port way too large'}          | ${'[0:123::4:56]:1023456789'}
  ${'IPv6 missing brackets'}            | ${'a:b:c::1234:8080'}
  ${'IPv6 "any" address'}               | ${'[::]:8080'}
  ${'IPv4 "any" address'}               | ${'[0.0.0.0]:8080'}
  ${'wildcard port `0`'}                | ${'12.34.5.66:0'}
  ${'wildcard port `*`'}                | ${'[12:34::5:66]:*'}
  ${'fd missing slash at start'}        | ${'dev/fd/3'}
  ${'fd with extra char at end'}        | ${'/dev/fd/123a'}
  ${'non-fd dev path'}                  | ${'/dev/florp'}
  ${'non-dev path'}                     | ${'/home/zorch/123'}
  ${'negative fd'}                      | ${'/dev/fd/-1'}
  ${'too-large fd'}                     | ${'/dev/fd/65536'}
  ${'much too-large fd'}                | ${'/dev/fd/999999999999999999999'}
  `('fails for $label', ({ mount }) => {
    expect(() => InterfaceAddress.parseInterface(mount)).toThrow();
  });

  // "Smokey" success tests.

  test('parses an interface with IPv4 address as expected', () => {
    const got = InterfaceAddress.parseInterface('12.34.56.78:123');
    expect(got).toStrictEqual({ address: '12.34.56.78', port: 123 });
  });

  test('parses an interface with IPv6 address as expected', () => {
    const got = InterfaceAddress.parseInterface('[abc::123:4567]:999');
    expect(got).toStrictEqual({ address: 'abc::123:4567', port: 999 });
  });

  test('parses an interface with wildcard address as expected', () => {
    const got = InterfaceAddress.parseInterface('*:17777');
    expect(got).toStrictEqual({ address: '*', port: 17777 });
  });

  test('parses an FD interface with no port as expected', () => {
    const got = InterfaceAddress.parseInterface('/dev/fd/109');
    expect(got).toStrictEqual({ fd: 109 });
  });

  test('parses an FD interface with port as expected', () => {
    const got = InterfaceAddress.parseInterface('/dev/fd/109:914');
    expect(got).toStrictEqual({ fd: 109, port: 914 });
  });

  test('accepts the minimum and maximum allowed FD numbers', () => {
    const got1 = InterfaceAddress.parseInterface('/dev/fd/0');
    expect(got1).toStrictEqual({ fd: 0 });

    const got2 = InterfaceAddress.parseInterface('/dev/fd/65535');
    expect(got2).toStrictEqual({ fd: 65535 });
  });
});
