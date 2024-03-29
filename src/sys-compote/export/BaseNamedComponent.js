// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent } from '#x/BaseComponent';
import { Names } from '#x/Names';


/**
 * Base class for components that must have (string) names, where those names
 * must be unique within the instances' hierarchies. The base class of this
 * class, {@link BaseComponent} does not do instance naming at all.
 *
 * This class requires that its concrete subclasses implement a configuration
 * class that includes a readable `name` property which abides by the contract
 * of {@link Names#checkName}.
 */
export class BaseNamedComponent extends BaseComponent {
  /**
   * Constructs an instance.
   *
   * @param {BaseConfig} config Configuration for this component.
   */
  constructor(config) {
    super(config);

    Names.checkName(config.name);
  }

  /** @override */
  get name() {
    return this.config.name;
  }
}
