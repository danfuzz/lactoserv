// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent } from '#x/BaseComponent';


/**
 * Base class for root components, that is, for components which are meant
 * to be used as the root component for their hierarchies.
 *
 * TODO: This class doesn't actually do anything... yet.
 *
 * @returns {function(new:*)} The instantiated template class.
 */
export class BaseRootComponent extends BaseComponent {
  // @defaultConstructor
};
