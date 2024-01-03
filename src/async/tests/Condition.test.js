// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Condition, PromiseState } from '@this/async';


describe('constructor()', () => {
  test('takes on the default value', () => {
    const cond = new Condition();
    expect(cond.value).toBeFalse();
  });
});

describe('constructor(value)', () => {
  test('takes on the constructed value', () => {
    const cond1 = new Condition(false);
    expect(cond1.value).toBeFalse();

    const cond2 = new Condition(true);
    expect(cond2.value).toBeTrue();
  });
});

describe('.value', () => {
  test('gets the value that was previously set', () => {
    const cond1 = new Condition(false);

    cond1.value = false;
    expect(cond1.value).toBeFalse();

    cond1.value = true;
    expect(cond1.value).toBeTrue();

    cond1.value = false;
    expect(cond1.value).toBeFalse();

    const cond2 = new Condition(true);

    cond2.value = false;
    expect(cond2.value).toBeFalse();

    cond2.value = true;
    expect(cond2.value).toBeTrue();
  });

  test('triggers `true` waiters when set from `false` to `true`', async () => {
    const cond = new Condition(false);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenTrue();
      triggered = true;
    })();

    cond.value = true;
    expect(triggered).toBeFalse();
    await waitDone;
    expect(triggered).toBeTrue();
  });

  test('triggers `false` waiters when set from `true` to `false`', async () => {
    const cond = new Condition(true);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenFalse();
      triggered = true;
    })();

    cond.value = false;
    expect(triggered).toBeFalse();
    await waitDone;
    expect(triggered).toBeTrue();
  });
});

describe('onOff()', () => {
  test('leaves the value `false`', () => {
    const cond = new Condition(false);

    cond.onOff();
    expect(cond.value).toBeFalse();

    cond.value = true;
    cond.onOff();
    expect(cond.value).toBeFalse();
  });

  test('triggers `true` waiters when value started out `false`', async () => {
    const cond = new Condition(false);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenTrue();
      triggered = true;
    })();

    cond.onOff();
    expect(triggered).toBeFalse();
    await waitDone;
    expect(triggered).toBeTrue();
  });

  test('triggers `false` waiters when value started out `true`', async () => {
    const cond = new Condition(true);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenTrue();
      triggered = true;
    })();

    cond.onOff();
    expect(triggered).toBeFalse();
    await waitDone;
    expect(triggered).toBeTrue();
  });
});

describe('whenFalse()', () => {
  test('triggers immediately if the value is already `false`', async () => {
    const cond = new Condition(false);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenFalse();
      triggered = true;
    })();

    await waitDone;
    expect(triggered).toBeTrue();
  });

  test('is a fulfilled promise if the value is already `false`', () => {
    const cond   = new Condition(false);
    const result = cond.whenFalse();

    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });
});

describe('whenTrue()', () => {
  test('triggers immediately if the value is already `true`', async () => {
    const cond = new Condition(true);
    let triggered = false;

    const waitDone = (async () => {
      await cond.whenTrue();
      triggered = true;
    })();

    await waitDone;
    expect(triggered).toBeTrue();
  });

  test('is a fulfilled promise if the value is already `true`', () => {
    const cond   = new Condition(true);
    const result = cond.whenTrue();

    expect(PromiseState.isFulfilled(result)).toBeTrue();
  });
});
