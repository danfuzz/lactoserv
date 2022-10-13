// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TokenBucket } from '@this/async';

/**
 * Mock implementation of `BaseTimeSource`.
 */
class MockTimeSource extends TokenBucket.BaseTimeSource {
  #now = 0;

  now() {
    return this.#now;
  }

  async setTimeout() {
    throw new Error('TODO');
  }

  _setNow(now) {
    this.#now = now;
  }
}

describe('constructor()', () => {
  test.each`
    opts
    ${{ capacity: 1, fillRate: 1 }}
    ${{ capacity: 1, fillRate: 1, initialVolume: 0 }}
    ${{ capacity: 1, fillRate: 1, initialVolume: 1 }}
    ${{ capacity: 10, fillRate: 1, initialVolume: 10 }}
    ${{ capacity: 10, fillRate: 1, initialVolume: 9 }}
    ${{ capacity: 1, fillRate: 1, partialTokens: false }}
    ${{ capacity: 1, fillRate: 1, partialTokens: true }}
    ${{ capacity: 1, fillRate: 1, timeSource: new TokenBucket.StdTimeSource() }}
    ${{ capacity: 1, fillRate: 1, timeSource: new MockTimeSource() }}
    ${{ capacity: 1, fillRate: 1, initialVolume: 0.5, partialTokens: true,
        timeSource: new MockTimeSource() }}
    TODO: more
  `('trivially accepts valid options: $opts', ({ opts }) => {
    expect(() => new TokenBucket(opts)).not.toThrow();
  });

  // TODO
});

describe('constructor(<invalid>)', () => {
  test.each`
    arg
    ${undefined}
    ${null}
    ${123}
    ${'hello'}
    ${new Map()}
  `('rejects non-object argument: $arg', () => {
    expect(() => new TokenBucket(arg)).toThrow();
  });

  test('rejects missing `capacity`', () => {
    expect(() => new TokenBucket({ fillRate: 1 })).toThrow();
  });

  test('rejects missing `fillRate`', () => {
    expect(() => new TokenBucket({ capacity: 1 })).toThrow();
  });

  test.each`
    capacity
    ${undefined}
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
    ${0}
    ${NaN}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `capacity`: $capacity', (capacity) => {
    expect(() => new TokenBucket({ capacity, fillRate: 1 })).toThrow();
  });

  test.each`
    fillRate
    ${undefined}
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
    ${0}
    ${NaN}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `fillRate`: $fillRate', (fillRate) => {
    expect(() => new TokenBucket({ fillRate, capacity: 1 })).toThrow();
  });

  test.each`
    initialVolume
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
  `('rejects invalid `initialVolume`: $initialVolume', (initialVolume) => {
    expect(() => new TokenBucket({ fillRate: 1, capacity: 1, initialVolume })).toThrow();
  });

  test('rejects invalid `initialVolume` (`> capacity`)', () => {
    expect(() => new TokenBucket({ fillRate: 1, capacity: 1, initialVolume: 1.01 })).toThrow();
    expect(() => new TokenBucket({ fillRate: 1, capacity: 1, initialVolume: 2 })).toThrow();
  });

  test.each`
    partialTokens
    ${null}
    ${'true'}
    ${[false]}
    ${0}
  `('rejects invalid `partialTokens`: $partialTokens', (partialTokens) => {
    expect(() => new TokenBucket({ fillRate: 1, capacity: 1, partialTokens })).toThrow();
  });

  test.each`
    timeSource
    ${null}
    ${[1, 2, 3]}
    ${new Map()}
    ${TokenBucket.BaseTimeSource /* supposed to be an instance, not a class */}
    ${MockTimeSource /* ditto */}
  `('rejects invalid `timeSource`: $timeSource', (timeSource) => {
    expect(() => new TokenBucket({ fillRate: 1, capacity: 1, timeSource })).toThrow();
  });
});

describe('takeNow()', () => {
  // TODO
});
