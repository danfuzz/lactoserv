// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseProxyHandler } from '@this/metacomp';


describe('makeProxy()', () => {
  describe('with no options', () => {
    test('constructs an object-like proxy around an instance of the called-upon subclass', () => {
      let gotArgs     = null;
      let gotTarget   = null;
      let gotProperty = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        get(target, property, receiver_unused) {
          gotTarget = target;
          gotProperty = property;
        }
      }

      const proxy = Subclass.makeProxy({}, 'x', 'y', 'z');

      expect(gotArgs).toStrictEqual(['x', 'y', 'z']);

      expect(proxy.florp).toBeUndefined();
      expect(gotTarget).toStrictEqual({});
      expect(gotTarget).toBeFrozen();
      expect(gotProperty).toBe('florp');
    });
  });

  describe('with option `{ callable: true }`', () => {
    test('constructs a function-like proxy around an instance of the called-upon subclass', () => {
      let gotArgs     = null;
      let gotProperty = null;
      let gotTarget   = null;
      let gotThis     = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        apply(target, thisArg, args) {
          gotTarget = target;
          gotThis   = thisArg;
          gotArgs   = args;

          return 'boop';
        }

        get(target, property, receiver_unused) {
          gotTarget   = target;
          gotProperty = property;
        }
      }

      const proxy = Subclass.makeProxy({ callable: true }, 'x', 'y', 'z');

      expect(gotArgs).toStrictEqual(['x', 'y', 'z']);

      expect(proxy.florp).toBeUndefined();
      expect(gotTarget).toBeFrozen();
      expect(gotTarget).toBeFunction();
      expect(gotProperty).toBe('florp');

      const callResult = proxy(1, 2, 3);
      expect(callResult).toBe('boop');
      expect(gotThis).toBeUndefined();
      expect(gotTarget).toBeFrozen();
      expect(gotTarget).toBeFunction();
      expect(gotArgs).toStrictEqual([1, 2, 3]);

      const someThis = { yes: 'yes', p: proxy };
      someThis.p('xyz');
      expect(gotThis).toBe(someThis);
      expect(gotArgs).toStrictEqual(['xyz']);
    });

    test('constructs a target with `name === \'\'`', () => {
      class Subclass extends BaseProxyHandler {
        get(target, property, receiver_unused) {
          return (property === 'name') ? target.name : undefined;
        }
      }

      const proxy = Subclass.makeProxy({ callable: true });
      expect(proxy.name).toBe('');
    });
  });

  describe('with options `{ callable: true, name: \'florp\' }`', () => {
    test('constructs a target with the expected `name`', () => {
      class Subclass extends BaseProxyHandler {
        get(target, property, receiver_unused) {
          return (property === 'name') ? target.name : undefined;
        }
      }

      const proxy = Subclass.makeProxy({ callable: true, name: 'florp' });
      expect(proxy.name).toBe('florp');
    });
  });

  describe('with option `{ class: SomeTarget }`', () => {
    test('constructs an instance-like proxy around an instance of the called-upon subclass', () => {
      let gotArgs     = null;
      let gotTarget   = null;
      let gotThis     = null;
      let gotProperty = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        apply(target, thisArg, args) {
          gotTarget = target;
          gotThis   = thisArg;
          gotArgs   = args;

          return 'zonk';
        }

        get(target, property, receiver_unused) {
          gotTarget = target;
          gotProperty = property;
        }
      }

      let targetConstructorCalled = 0;
      class SomeTarget {
        constructor() {
          targetConstructorCalled++;
        }

        get florp() {
          throw new Error('Should not get accessed.');
        }
      }

      const proxy = Subclass.makeProxy({ class: SomeTarget }, 'x', 'y', 'z');

      expect(proxy).toBeInstanceOf(SomeTarget);
      expect(targetConstructorCalled).toBe(0);
      expect(gotArgs).toStrictEqual(['x', 'y', 'z']);

      expect(proxy.florp).toBeUndefined();
      expect(gotTarget).toBeInstanceOf(SomeTarget);
      expect(gotTarget).toBeFrozen();
      expect(gotProperty).toBe('florp');

      gotTarget = null;
      gotThis   = null;
      gotArgs   = null;
      expect(() => proxy('eep')).toThrow();
      expect(gotTarget).toBeNull();
      expect(gotThis).toBeNull();
      expect(gotArgs).toBeNull();
    });
  });

  describe('with options `{ callable: true, class: SomeTarget }`', () => {
    test('constructs a function- and instance-like proxy around an instance of the called-upon subclass', () => {
      let gotArgs     = null;
      let gotTarget   = null;
      let gotThis     = null;
      let gotProperty = null;

      class Subclass extends BaseProxyHandler {
        constructor(...args) {
          super();
          gotArgs = args;
        }

        apply(target, thisArg, args) {
          gotTarget = target;
          gotThis   = thisArg;
          gotArgs   = args;

          return 'zonk';
        }

        get(target, property, receiver_unused) {
          gotTarget = target;
          gotProperty = property;
        }
      }

      let targetConstructorCalled = 0;
      class SomeTarget {
        constructor() {
          targetConstructorCalled++;
        }

        get florp() {
          throw new Error('Should not get accessed.');
        }
      }

      const proxy = Subclass.makeProxy({ callable: true, class: SomeTarget }, 'x', 'y', 'z');

      expect(proxy).toBeInstanceOf(SomeTarget);
      expect(targetConstructorCalled).toBe(0);
      expect(gotArgs).toStrictEqual(['x', 'y', 'z']);

      expect(proxy.florp).toBeUndefined();
      expect(gotTarget).toBeInstanceOf(SomeTarget);
      expect(gotTarget).toBeFrozen();
      expect(gotProperty).toBe('florp');

      gotTarget = null;
      gotThis   = null;
      gotArgs   = null;
      expect(proxy('eep')).toBe('zonk');
      expect(gotArgs).toStrictEqual(['eep']);
      expect(gotTarget).toBeInstanceOf(SomeTarget);
      expect(gotThis).toBeUndefined();

      const someThis = { oh: 'yeah', p: proxy };
      someThis.p('bonk', 123);
      expect(gotThis).toBe(someThis);
      expect(gotArgs).toStrictEqual(['bonk', 123]);
    });

    test('constructs a target with `name === \'\'`', () => {
      class Subclass extends BaseProxyHandler {
        get(target, property, receiver_unused) {
          return (property === 'name') ? target.name : undefined;
        }
      }

      class SomeTarget {
        // @emptyBlock
      }

      const proxy = Subclass.makeProxy({ callable: true, class: SomeTarget });
      expect(proxy.name).toBe('');
    });
  });

  describe('with options `{ callable: true, class: SomeTarget, name: \'zorch\' }`', () => {
    test('constructs a target with the expected `name`', () => {
      class Subclass extends BaseProxyHandler {
        get(target, property, receiver_unused) {
          return (property === 'name') ? target.name : undefined;
        }
      }

      class SomeTarget {
        // @emptyBlock
      }

      const proxy = Subclass.makeProxy({ callable: true, class: SomeTarget, name: 'zorch' });
      expect(proxy.name).toBe('zorch');
    });
  });
});

describe('constructor', () => {
  test('constructs an instance', () => {
    expect(() => new BaseProxyHandler()).not.toThrow();
  });
});

describe('apply()', () => {
  test('always throws', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new BaseProxyHandler();
    const proxy   = new Proxy(func, handler);
    expect(() => handler.apply(func, proxy, [1, 2, 3])).toThrow(/(?!XYZ)/);
  });
});

describe('construct()', () => {
  test('always throws', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new BaseProxyHandler();
    const proxy   = new Proxy(func, handler);
    expect(() => handler.construct(func, proxy, [1, 2, 3])).toThrow(/(?!XYZ)/);
  });
});

describe('defineProperty()', () => {
  test('always returns `false`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.defineProperty({}, 'blort', { value: 123 })).toBeFalse();
  });
});

describe('deleteProperty()', () => {
  test('always returns `false`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.deleteProperty({ blort: 10 }, 'blort')).toBeFalse();
  });
});

describe('get()', () => {
  test('always returns `undefined`', () => {
    const handler = new BaseProxyHandler();

    expect(handler.get({}, 'x', {})).toBeUndefined();
    expect(handler.get({}, 'florp', {})).toBeUndefined();
  });
});

describe('getOwnPropertyDescriptor()', () => {
  test('always throws', () => {
    const handler = new BaseProxyHandler();
    expect(() => handler.getOwnPropertyDescriptor({ blort: 123 }, 'blort')).toThrow();
  });
});

describe('getPrototypeOf()', () => {
  test('returns the target\'s prototype', () => {
    const handler = new BaseProxyHandler();
    const obj     = new Map();
    expect(handler.getPrototypeOf(obj)).toBe(Object.getPrototypeOf(obj));
  });
});

describe('has()', () => {
  test('always returns `false`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.has({ blort: 10 }, 'blort')).toBeFalse();
  });
});

describe('isExtensible()', () => {
  test('always returns `false`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.isExtensible({})).toBeFalse();
  });
});

describe('ownKeys()', () => {
  test('always returns `[]`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.ownKeys({ a: 10, b: 20 })).toStrictEqual([]);
  });
});

describe('preventExstensions()', () => {
  test('always returns `true`', () => {
    const handler = new BaseProxyHandler();
    expect(handler.preventExtensions({})).toBeTrue();
  });
});

describe('set()', () => {
  test('always returns `false`', () => {
    const func    = () => { throw new Error('XYZ should not have been called'); };
    const handler = new BaseProxyHandler();
    const proxy   = new Proxy(func, handler);
    expect(handler.set({}, 'blort', 123, proxy)).toBeFalse();
  });
});

describe('setPrototypeOf()', () => {
  test('always returns `false`', () => {
    const handler = new BaseProxyHandler();

    expect(handler.setPrototypeOf({}, null)).toBeFalse();
    expect(handler.setPrototypeOf({}, {})).toBeFalse();
  });
});
