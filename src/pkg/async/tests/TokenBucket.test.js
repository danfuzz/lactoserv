// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { TokenBucket } from '@this/async';

/**
 * Mock implementation of `BaseTimeSource`.
 */
class MockTimeSource extends TokenBucket.BaseTimeSource {
  #now = 0;

  get unitName() {
    return 'some-unit';
  }

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
    ${{ burstSize: 1, flowRate: 1 }}
    ${{ burstSize: 0.01, flowRate: 0.0001 }}
    ${{ burstSize: 200000, flowRate: 109 }}
    ${{ burstSize: 1, flowRate: 1, initialBurst: 0 }}
    ${{ burstSize: 1, flowRate: 1, initialBurst: 1 }}
    ${{ burstSize: 10, flowRate: 1, initialBurst: 10 }}
    ${{ burstSize: 10, flowRate: 1, initialBurst: 9 }}
    ${{ burstSize: 1, flowRate: 1, maxGrantSize: 0.1 }}
    ${{ burstSize: 1, flowRate: 1, maxGrantSize: 1 }}
    ${{ burstSize: 100, flowRate: 1, maxGrantSize: 1 }}
    ${{ burstSize: 100, flowRate: 1, maxGrantSize: 50 }}
    ${{ burstSize: 100, flowRate: 1, maxGrantSize: 99 }}
    ${{ burstSize: 1, flowRate: 1, maxWaiters: 1000 }}
    ${{ burstSize: 1, flowRate: 1, maxWaiters: 0 }}
    ${{ burstSize: 1, flowRate: 1, maxWaiters: 1 }}
    ${{ burstSize: 1, flowRate: 1, maxWaiters: 1000 }}
    ${{ burstSize: 1, flowRate: 1, partialTokens: false }}
    ${{ burstSize: 123.456, flowRate: 12.3, partialTokens: false }}
    ${{ burstSize: 1, flowRate: 1, partialTokens: true }}
    ${{ burstSize: 1, flowRate: 1, timeSource: new TokenBucket.StdTimeSource() }}
    ${{ burstSize: 1, flowRate: 1, timeSource: new MockTimeSource() }}
    ${{ burstSize: 1, flowRate: 1, initialBurst: 0.5, maxGrantSize: 0.5,
        maxWaiters: 10, partialTokens: true, timeSource: new MockTimeSource() }}
  `('trivially accepts valid options: $opts', ({ opts }) => {
    expect(() => new TokenBucket(opts)).not.toThrow();
  });

  test('produces an instance with the `burstSize` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 123 });
    expect(bucket.config.burstSize).toBe(123);
  });

  test('produces an instance with the `flowRate` that was passed', () => {
    const bucket = new TokenBucket({ flowRate: 1234, burstSize: 100000 });
    expect(bucket.config.flowRate).toBe(1234);
  });

  test.each`
    maxGrantSize
    ${0.1}
    ${1}
    ${200}
  `('produces an instance with the `maxGrantSize` that was passed: $maxGrantSize', ({ maxGrantSize }) => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1000, maxGrantSize });
    expect(bucket.config.maxGrantSize).toBe(maxGrantSize);
  });

  test('has `maxGrantSize === burstSize` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 10203 });
    expect(bucket.config.maxGrantSize).toBe(10203);
  });

  test.each`
    maxWaiters
    ${null}
    ${0}
    ${10}
  `('produces an instance with the `maxWaiters` that was passed: $maxWaiters', ({ maxWaiters }) => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1, maxWaiters });
    expect(bucket.config.maxWaiters).toBe(maxWaiters);
  });

  test('has `maxWaiters === null` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1 });
    expect(bucket.config.maxWaiters).toBeNull();
  });

  test.each`
    partialTokens
    ${false}
    ${true}
  `('produces an instance with the `partialTokens` that was passed: $partialTokens', ({ partialTokens }) => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1, partialTokens });
    expect(bucket.config.partialTokens).toBe(partialTokens);
  });

  test('has `partialTokens === false` if not passed', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1 });
    expect(bucket.config.partialTokens).toBeFalse();
  });

  test('produces an instance which uses the `timeSource` that was passed', () => {
    const ts = new MockTimeSource();
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1, timeSource: ts });
    expect(bucket.config.timeSource).toBe(ts);
  });

  test('produces an instance which (apparently) uses the default time source if not passed `timeSource`', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 1 });
    expect(bucket.config.timeSource).toBeNull();
  });

  test('produces an instance with `availableBurst` equal to the passed `initialBurst`', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 100, initialBurst: 23 });
    expect(bucket.snapshotNow().availableBurst).toBe(23);
  });

  test('has `availableBurst === burstSize` if not passed `initialBurst`', () => {
    const bucket = new TokenBucket({ flowRate: 1, burstSize: 123 });
    expect(bucket.snapshotNow().availableBurst).toBe(123);
  });
});

describe('constructor(<invalid>)', () => {
  test.each`
    arg
    ${undefined}
    ${null}
    ${123}
    ${'hello'}
    ${new Map()}
  `('rejects non-object argument: $arg', ({ arg }) => {
    expect(() => new TokenBucket(arg)).toThrow();
  });

  test('rejects missing `burstSize`', () => {
    expect(() => new TokenBucket({ flowRate: 1 })).toThrow();
  });

  test('rejects missing `flowRate`', () => {
    expect(() => new TokenBucket({ burstSize: 1 })).toThrow();
  });

  test.each`
    burstSize
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
  `('rejects invalid `burstSize`: $burstSize', ({ burstSize }) => {
    expect(() => new TokenBucket({ burstSize, flowRate: 1 })).toThrow();
  });

  test.each`
    flowRate
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
  `('rejects invalid `flowRate`: $flowRate', ({ flowRate }) => {
    expect(() => new TokenBucket({ flowRate, burstSize: 1 })).toThrow();
  });

  test.each`
    initialBurst
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${-1}
    ${-0.1}
  `('rejects invalid `initialBurst`: $initialBurst', ({ initialBurst }) => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, initialBurst })).toThrow();
  });

  test('rejects invalid `initialBurst` (`> burstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, initialBurst: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, initialBurst: 2 })).toThrow();
  });

  test.each`
    maxGrantSize
    ${null}
    ${true}
    ${'123'}
    ${[123]}
    ${0}
    ${-1}
    ${-0.1}
  `('rejects invalid `maxGrantSize`: $maxGrantSize', ({ maxGrantSize }) => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1000, maxGrantSize })).toThrow();
  });

  test('rejects invalid `maxGrantSize` (`> burstSize`)', () => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, maxGrantSize: 1.01 })).toThrow();
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, maxGrantSize: 2 })).toThrow();
  });

  test.each`
    maxWaiters
    ${false}
    ${'123'}
    ${[123]}
    ${-1}
    ${0.1}
    ${Number.POSITIVE_INFINITY}
  `('rejects invalid `maxWaiters`: $maxWaiters', ({ maxWaiters }) => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, maxWaiters })).toThrow();
  });

  test.each`
    partialTokens
    ${null}
    ${'true'}
    ${[false]}
    ${0}
  `('rejects invalid `partialTokens`: $partialTokens', ({ partialTokens }) => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, partialTokens })).toThrow();
  });

  test.each`
    timeSource
    ${null}
    ${[1, 2, 3]}
    ${new Map()}
    ${TokenBucket.BaseTimeSource /* supposed to be an instance, not a class */}
    ${MockTimeSource /* ditto */}
  `('rejects invalid `timeSource`: $timeSource', ({ timeSource }) => {
    expect(() => new TokenBucket({ flowRate: 1, burstSize: 1, timeSource })).toThrow();
  });
});

describe('.config', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: 123, burstSize: 100000 });
    expect(bucket.config).toContainAllKeys([
      'burstSize', 'flowRate', 'maxGrantSize', 'maxWaiters', 'partialTokens',
      'timeSource'
    ]);
  });
});

describe('denyAllRequests()', () => {
  // TODO
});

describe('requestGrant()', () => {
  // TODO
});

describe('snapshotNow()', () => {
  test('has exactly the expected properties', () => {
    const bucket = new TokenBucket({ flowRate: 123, burstSize: 100000 });
    expect(bucket.snapshotNow()).toContainAllKeys([
      'availableBurst', 'now', 'waiters'
    ]);
  });
});

describe('takeNow()', () => {
  // TODO
});

describe('wait()', () => {
  // TODO
});
