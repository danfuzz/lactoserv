// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseRootComponent } from '#x/BaseRootComponent';
import { TemplAggregateComponent } from '#x/TemplAggregateComponent';


/**
 * Minimal concrete _root_ component class, which has no-op implementations for
 * all `_impl_*` methods and which is expected to be used in "mocking" test
 * scenarios.
 */
export class MockRootComponent extends TemplAggregateComponent('MockAggregate', BaseRootComponent) {
  // @defaultConstructor
}
