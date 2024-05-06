// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent } from '#x/BaseComponent';
import { TemplAggregateComponent } from '#x/TemplAggregateComponent';


/**
 * Minimal concrete component class, which has no-op implementations for all
 * `_impl_*` methods and which is expected to be used in "mocking" test
 * scenarios.
 */
export class MockComponent extends TemplAggregateComponent('MockAggregate', BaseComponent) {
  // @defaultConstructor
}
