// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { ProductInfo } from '@this/host';
import { AskIf } from '@this/typey';


describe('.allInfo', () => {
  test('returns a plain object of the generally-expected shape', () => {
    const got = ProductInfo.allInfo;
    expect(AskIf.plainObject(got)).toBeTrue();
    expect(got).toContainAllKeys(['commit', 'name', 'version']);
  });

  test('returns a different object with each invocation', () => {
    const got1 = ProductInfo.allInfo;
    const got2 = ProductInfo.allInfo;
    expect(got1).not.toBe(got2);
  });
});

describe('.commit', () => {
  test('returns a string of the generally-expected shape', () => {
    const got = ProductInfo.commit;
    expect(got).toBeString();
    expect(got).toMatch(/^[0-9a-f]{5,10}( [-_.0-9A-Za-z]+)*$/);
  });
});

describe('.name', () => {
  test('returns a string of the generally-expected shape', () => {
    const got = ProductInfo.name;
    expect(got).toBeString();
    expect(got).toMatch(/^[-0-9A-Za-z]{2,50}$/);
  });
});

describe('.version', () => {
  test('returns a string of the generally-expected shape', () => {
    const got = ProductInfo.version;
    expect(got).toBeString();
    expect(got).toMatch(/^[-.0-9A-Za-z]{1,50}$/);
  });
});
