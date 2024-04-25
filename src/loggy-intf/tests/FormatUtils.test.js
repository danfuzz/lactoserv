// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { FormatUtils } from '@this/loggy-intf';


describe('addressPortString()', () => {
  test.each`
  address                                      | port     | expected
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${65432} | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]:65432'}
  ${'123.255.199.126'}                         | ${54321} | ${'123.255.199.126:54321'}
  ${'::ffff:123.255.199.126'}                  | ${12345} | ${'123.255.199.126:12345'}
  ${'foo.bar'}                                 | ${12}    | ${'foo.bar:12'}
  ${'1234:5678:9abc:def0:0987:6543:210a:bcde'} | ${null}  | ${'[1234:5678:9abc:def0:0987:6543:210a:bcde]'}
  ${'123.255.199.126'}                         | ${null}  | ${'123.255.199.126'}
  ${'::ffff:123.255.199.126'}                  | ${null}  | ${'123.255.199.126'}
  ${'foo.bar'}                                 | ${null}  | ${'foo.bar'}
  ${null}                                      | ${0}     | ${'<unknown>:0'}
  ${null}                                      | ${1}     | ${'<unknown>:1'}
  ${null}                                      | ${10000} | ${'<unknown>:10000'}
  ${null}                                      | ${null}  | ${'<unknown>'}
  ${'::'}                                      | ${123}   | ${'[::]:123'}
  ${'::ffff:abcd'}                             | ${99}    | ${'[::ffff:abcd]:99'}
  ${'123::ffff:432'}                           | ${7777}  | ${'[123::ffff:432]:7777'}
  `('with ($address, $port)', ({ address, port, expected }) => {
    expect(FormatUtils.addressPortString(address, port)).toBe(expected);
  });
});

describe('networkInteraceString()', () => {
  test.each`
  iface                                     | expected
  ${{ fd: 3 }}                              | ${'/dev/fd/3'}
  ${{ fd: 987 }}                            | ${'/dev/fd/987'}
  ${{ address: 'florp.biz', port: 123 }}    | ${'florp.biz:123'}
  ${{ address: '10.28.18.0', port: 80 }}    | ${'10.28.18.0:80'}
  ${{ address: 'a0:b::c:d9', port: 443 }}   | ${'[a0:b::c:d9]:443'}
  ${{ address: 'like.cat', port: null }}    | ${'like.cat'}
  ${{ address: '199.2.3.4', port: null }}   | ${'199.2.3.4'}
  ${{ address: '123a::456:f', port: null }} | ${'[123a::456:f]'}
  `('with ($iface)', ({ iface, expected }) => {
    expect(FormatUtils.networkInterfaceString(iface)).toBe(expected);
  });
});
