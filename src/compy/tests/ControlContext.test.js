// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseAggregateComponent, BaseConfig, ControlContext,
  RootControlContext }
  from '@this/compy';

/**
 * Fake component that implements just enough stuff for the tests here.
 */
class MockComponent extends BaseAggregateComponent {
  /** @override */
  async _impl_init(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_start(isReload_unused) {
    // @emptyBlock
  }

  /** @override */
  async _impl_stop(willReload_unused) {
    // @emptyBlock
  }

  /** @override */
  static _impl_configClass() {
    return BaseConfig;
  }
}

describe('constructor', () => {
  test('picks appropriate names for otherwise-nameless components', async () => {
    const root = new MockComponent({}, new RootControlContext(null));
    await root.start();

    class SomeName extends MockComponent {
      // @emptyBlock
    }

    class OtherName extends MockComponent {
      // @emptyBlock
    }

    const comp1 = new SomeName({});
    const comp2 = new SomeName({});
    const comp3 = new OtherName({ name: 'otherName2' });
    const comp4 = new OtherName({});
    const comp5 = new OtherName({});

    await root.addChild(comp1);
    await root.addChild(comp2);
    await root.addChild(comp3);
    await root.addChild(comp4);
    await root.addChild(comp5);

    expect(comp1.namePath.path).toEqual(['someName1']);
    expect(comp2.namePath.path).toEqual(['someName2']);
    expect(comp3.namePath.path).toEqual(['otherName2']);
    expect(comp4.namePath.path).toEqual(['otherName1']);
    expect(comp5.namePath.path).toEqual(['otherName3']);

    const comp6 = new SomeName({});
    const comp7 = new SomeName({});

    await comp1.addChild(comp6);
    await comp1.addChild(comp7);

    expect(comp6.namePath.path).toEqual(['someName1', 'someName1']);
    expect(comp7.namePath.path).toEqual(['someName1', 'someName2']);
  });
})
