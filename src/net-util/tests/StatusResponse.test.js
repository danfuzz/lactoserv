// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { StatusResponse } from '@this/net-util';


describe('constructor()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${'123'}
  ${[123]}
  ${{ a: 123 }}
  ${new Set([123])}
  99                // This and the rest are improper status numbers
  -100
  100.1
  200.1
  600
  700
  123456789e123
  `('throws given $arg', ({ arg }) => {
    expect(() => new StatusResponse(arg)).toThrow();
  });

  test.each`
  arg
  ${100}
  ${200}
  ${204}
  ${300}
  ${308}
  ${400}
  ${404}
  ${500}
  ${599}
  `('accepts $arg', ({ arg }) => {
    expect(() => new StatusResponse(arg)).not.toThrow();
  });
});

describe('.status', () => {
  test('is the argument from the constructor', () => {
    const status = 123;
    expect(new StatusResponse(status).status).toBe(status);
  });
});


//
// Static members
//

describe('.NOT_FOUND', () => {
  test('is an instance of this class', () => {
    expect(StatusResponse.NOT_FOUND).toBeInstanceOf(StatusResponse);
  });

  test('is always the same instance', () => {
    const nf1 = StatusResponse.NOT_FOUND;
    const nf2 = StatusResponse.NOT_FOUND;
    expect(nf1).toBe(nf2);
  });

  test('has `status === 404`', () => {
    expect(StatusResponse.NOT_FOUND.status).toBe(404);
  });
});

describe('fromStatus()', () => {
  test('produces an instance with the given `status`', () => {
    const status = 543;
    const got    = StatusResponse.fromStatus(status);

    expect(got.status).toBe(status);
  });

  test('interns the instances it returns', () => {
    const status1 = 123;
    const status2 = 234;
    const got1a   = StatusResponse.fromStatus(status1);
    const got2a   = StatusResponse.fromStatus(status2);
    const got1b   = StatusResponse.fromStatus(status1);
    const got2b   = StatusResponse.fromStatus(status2);

    expect(got1a.status).toBe(status1);
    expect(got2a.status).toBe(status2);

    expect(got1a).toBe(got1b);
    expect(got2a).toBe(got2b);
  });
});
