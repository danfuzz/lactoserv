// Copyright 2022 Dan Bornstein. All rights reserved.
// All code and assets are considered proprietary and unlicensed.

import { MethodCacheProxyHandler } from '@this/metaclass';

import * as util from 'node:util';

/**
 * Subclass of the class to test which always throws when asked to create a
 * method handler.
 */
class ThrowingHandler extends MethodCacheProxyHandler {
  _impl_forMethod(name_unused) {
    throw new Error('XYZ should not have been called.');
  }
}

describe('constructor', () => {
  test('constructs an instance', () => {
    expect(() => new MethodCacheProxyHandler()).not.toThrow();
  });
});

describe('apply()', () => {
  test('always throws', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new ThrowingHandler();
    const proxy   = new Proxy(func, handler);
    expect(() => handler.apply(func, proxy, [1, 2, 3])).toThrow(/(?!XYZ)/);
  });
});

describe('construct()', () => {
  test('always throws', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new ThrowingHandler();
    const proxy   = new Proxy(func, handler);
    expect(() => handler.construct(func, proxy, [1, 2, 3])).toThrow(/(?!XYZ)/);
  });
});

describe('defineProperty()', () => {
  test('always returns `false`', () => {
    const handler = new ThrowingHandler();
    expect(handler.defineProperty({}, 'blort', { value: 123 })).toBeFalse();
  });
});

describe('deleteProperty()', () => {
  test('always returns `false`', () => {
    const handler = new ThrowingHandler();
    expect(handler.deleteProperty({ blort: 10 }, 'blort')).toBeFalse();
  });
});

describe('get()', () => {
  test('returns `undefined` for verboten property names', () => {
    const th = new ThrowingHandler();

    expect(th.get(Map, 'constructor')).toBeUndefined();

    const prom = new Promise(() => { /*empty*/ });
    expect(th.get(prom, 'then')).toBeUndefined();
    expect(th.get(prom, 'catch')).toBeUndefined();
  });

  // `if` to prevent this test from being active on a browser client,
  // because the `util.inspect` shim can't be expected to deal properly with
  // `custom`.
  if (typeof util.inspect.custom === 'symbol') {
    test('returns the expected special-case `inspect.custom` implementation', () => {
      const handler    = new MethodCacheProxyHandler();
      const proxy      = new Proxy({}, handler);
      const customFunc = proxy[util.inspect.custom];

      expect(customFunc()).toBe('[object Proxy]');
    });
  }

  test('returns a function gotten from a call to the `_impl`', () => {
    const handler = new MethodCacheProxyHandler();
    const proxy   = new Proxy({}, handler);

    handler._impl_methodFor = (name) => {
      const result = () => { return; };
      result.blorp = `blorp-${name}`;
      return result;
    };

    const result = handler.get({}, 'zorp', proxy);
    expect(result.blorp).toBe('blorp-zorp');
  });

  test('returns the same function upon a second-or-more call with the same name', () => {
    const handler = new MethodCacheProxyHandler();
    const proxy   = new Proxy({}, handler);

    handler._impl_methodFor = (name) => {
      const result = () => { return; };
      result.blorp = `blorp-${name}`;
      return result;
    };

    const result1a = handler.get({}, 'zip', proxy);
    const result2a = handler.get({}, 'zot', proxy);
    const result1b = handler.get({}, 'zip', proxy);
    const result2b = handler.get({}, 'zot', proxy);

    expect(result1a.blorp).toBe('blorp-zip');
    expect(result2a.blorp).toBe('blorp-zot');
    expect(result1a).toBe(result1b);
    expect(result2a).toBe(result2b);
  });
});

describe('getOwnPropertyDescriptor()', () => {
  test('always throws', () => {
    const handler = new ThrowingHandler();
    expect(() => handler.getOwnPropertyDescriptor({ blort: 123 }, 'blort')).toThrow();
  });
});

describe('getPrototypeOf()', () => {
  test('returns the target\'s prototype', () => {
    const handler = new ThrowingHandler();
    const obj     = new Map();
    expect(handler.getPrototypeOf(obj)).toBe(Object.getPrototypeOf(obj));
  });
});

describe('has()', () => {
  test('always returns `false`', () => {
    const handler = new ThrowingHandler();
    expect(handler.has({ blort: 10 }, 'blort')).toBeFalse();
  });
});

describe('isExtensible()', () => {
  test('always returns `false`', () => {
    const handler = new ThrowingHandler();
    expect(handler.isExtensible({})).toBeFalse();
  });
});

describe('ownKeys()', () => {
  test('always returns `[]`', () => {
    const handler = new ThrowingHandler();
    expect(handler.ownKeys({ a: 10, b: 20 })).toStrictEqual([]);
  });
});

describe('preventExstensions()', () => {
  test('always returns `true`', () => {
    const handler = new ThrowingHandler();
    expect(handler.preventExtensions({})).toBeTrue();
  });
});

describe('set()', () => {
  test('always returns `false`', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new ThrowingHandler();
    const proxy   = new Proxy(func, handler);
    expect(handler.set({}, 'blort', 123, proxy)).toBeFalse();
  });
});

describe('setPrototypeOf()', () => {
  test('always returns `false`', () => {
    const handler = new ThrowingHandler();

    expect(handler.setPrototypeOf({}, null)).toBeFalse();
    expect(handler.setPrototypeOf({}, {})).toBeFalse();
  });
});
