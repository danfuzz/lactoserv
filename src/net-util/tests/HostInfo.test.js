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
// TODO: nameString
// TODO: portNumber
// TODO: portString
// TODO: nameIsIpAddress
// TODO: localhostInstance
// TODO: parseHostHeader
// TODO: safeParseHostHeader
