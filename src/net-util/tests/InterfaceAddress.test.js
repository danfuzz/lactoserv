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

    expect(ia1.address).toBe('121.134.56.78');
    expect(ia2.address).toBe('12.34.56.78');
  });

  test('is the canonicalized form of the IP address if it was not canonical', () => {
    const ia1 = new InterfaceAddress('001.034.006.078:999');
    const ia2 = new InterfaceAddress({ address: '012.034.056.078', portNumber: 999 });

    expect(ia1.address).toBe('1.34.6.78');
    expect(ia2.address).toBe('12.34.56.78');
  });

  test('is the constructed hostname if it was constructed with a hostname', () => {
    const ia1 = new InterfaceAddress('bleep.bloop:111');
    const ia2 = new InterfaceAddress({ address: 'blop.glop.gleep', portNumber: 222 });

    expect(ia1.address).toBe('bleep.bloop');
    expect(ia2.address).toBe('blop.glop.gleep');
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
  // ... TODO ...
  `('succeeds for $address', ({ address }) => {
    const ia = new InterfaceAddress(address);
    expect(ia.toString()).toBe(address);
  });

  // Success cases that are given in canonical plain-object form.
  test.each`
  address          | fd      | portNumber
  ${'10.0.0.1'}    | ${null} | ${77}
  // ... TODO ...
  `('succeeds for ($address, $fd, $portNumber)', ({ address, fd, portNumber }) => {
    const ia = new InterfaceAddress({ address, fd, portNumber });
    const expected =
      (address ?? `/dev/fd${portNumber}`) +
      ((portNumber === null) ? '' : `:${portNumber}`);
    expect(ia.toString()).toBe(expected);
  });

  // Success cases that are given in non-canonical string form.
  test.each`
  address                          | expected
  ${'010.0.0.1:09'}                | ${'10.0.0.1:9'}
  // ... TODO ...
  `('returns `$expected` given `$address`', ({ address, expected }) => {
    const ia = new InterfaceAddress(address);
    expect(ia.toString()).toBe(expected);
  });

  // Success cases that are given in non-canonical plain-object form. (We only
  // need to check things where `address` is non-canonical, because in the
  // plain-object form, `portNumber` and `fd` can't possibly be non-canonical.)
  test.each`
  address                       | expected
  ${'010.0.0.1'}                | ${'10.0.0.1'}
  // ... TODO ...
  `('returns `$expected` given `$address`', ({ address, expected }) => {
    const ia = new InterfaceAddress({ address, portNumber: 8877 });
    expect(ia.toString()).toBe(`${expected}:8877`);
  });
});
