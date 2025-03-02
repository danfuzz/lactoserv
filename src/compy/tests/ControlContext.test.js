// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MockComponent, MockRootComponent } from '@this/compy/testing';


describe('constructor', () => {
  test('picks appropriate names for otherwise-nameless components', async () => {
    const root = new MockRootComponent();
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

    await root.addAll(comp1, comp2, comp3, comp4, comp5);

    expect(comp1.namePath.path).toEqual(['someName1']);
    expect(comp2.namePath.path).toEqual(['someName2']);
    expect(comp3.namePath.path).toEqual(['otherName2']);
    expect(comp4.namePath.path).toEqual(['otherName1']);
    expect(comp5.namePath.path).toEqual(['otherName3']);

    const comp6 = new SomeName({});
    const comp7 = new SomeName({});

    await comp1.addAll(comp6, comp7);

    expect(comp6.namePath.path).toEqual(['someName1', 'someName1']);
    expect(comp7.namePath.path).toEqual(['someName1', 'someName2']);
  });
});
