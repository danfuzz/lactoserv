// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IdGenerator } from '@this/loggy-intf';
import { Duration, Moment } from '@this/quant';


describe('constructor', () => {
  test('succeeds', () => {
    expect(() => new IdGenerator()).not.toThrow();
  });
});

describe('makeId()', () => {
  test.each`
  arg
  ${undefined}
  ${null}
  ${true}
  ${123}
  ${123n}
  ${'florp'}
  ${{ x: 123 }}
  `('throws given $arg', ({ arg }) => {
    const gen = new IdGenerator();
    expect(() => gen.makeId(arg)).toThrow();
  });

  test('produces a value in the expected format', () => {
    const gen    = new IdGenerator();
    const moment = new Moment(1715189931);
    const got    = gen.makeId(moment);

    expect(got).toBeString(/^[a-z]{2}_[0-9a-f]{5}_00$/);
  });

  test('produces sequential values when called multiple times with the same argument', () => {
    const gen    = new IdGenerator();
    const moment = new Moment(1715101234);

    for (let i = 0; i < 100; i++) {
      const got    = gen.makeId(moment);
      const suffix = `0${i.toString(16)}`.slice(-2);
      expect(got).toBeString(/^[a-z]{2}_[0-9a-f]{5}_[0-9a-f]{2}$/);
      expect(got.slice(-2)).toBe(suffix);
    }
  });

  test('produces a four-, six-, and eight-digit sequence numbers when necessary', () => {
    const gen    = new IdGenerator();
    const moment = new Moment(1999101234);

    gen.makeId(moment);

    gen.setSequenceNumber(0xff);
    expect(gen.makeId(moment)).toBeString(/_ff$/);
    expect(gen.makeId(moment)).toBeString(/_0100$/);

    gen.setSequenceNumber(0xffff);
    expect(gen.makeId(moment)).toBeString(/_ffff$/);
    expect(gen.makeId(moment)).toBeString(/_010000$/);

    gen.setSequenceNumber(0xffffff);
    expect(gen.makeId(moment)).toBeString(/_ffffff$/);
    expect(gen.makeId(moment)).toBeString(/_01000000$/);
  });

  test('resets the sequence number when called with a different minute', () => {
    const gen     = new IdGenerator();
    const moment1 = new Moment(1715998877);
    const moment2 = moment1.add(Duration.parse('1 min'));

    const got1 = gen.makeId(moment1);
    expect(got1).toBeString(/_00$/);
    expect(gen.makeId(moment1)).toBeString(/_01$/);

    const got2 = gen.makeId(moment2);
    expect(got2).toBeString(/_00$/);
    expect(got2).not.toBe(got1);
  });
});
