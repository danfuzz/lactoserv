// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent } from '#x/BaseComponent';
import { IntfComponent } from '#x/IntfComponent';


/**
 * Abstract subclass of {@link BaseComponent} which allows child components to
 * be added to it as part of its _public_ interface. (All components are allowed
 * to add children on their own behalf.)
 *
 * Concrete subclasses are allowed to define a check on would-be children, which
 * is called prior to the actual addition.
 */
export class BaseAggregateComponent extends BaseComponent {
  // @defaultConstructor

  /**
   * Adds one or more children to this instance.
   *
   * @param {...IntfComponent} children Components to add.
   */
  async addChildren(...children) {
    for (const child of children) {
      if (!await this._impl_isChildAllowed(child)) {
        throw new Error(`Child cannot be added: ${child}`);
      }
    }

    for (const child of children) {
      await this._impl_addChild(child);
      await this._prot_addChild(child);
    }
  }

  /**
   * Subclass-specific behavior for adding a child. Subclasses that want to do
   * anything extra when adding a child should override this. This method is
   * called _after_ the call to {@link #_impl_isChildAllowed} and _before_
   * the call to {@link #_prot_addChild} on the base class. By default, this
   * method does nothing.
   *
   * @param {IntfComponent} child Child component.
   */
  async _impl_addChild(child) { // eslint-disable-line no-unused-vars
    // @emptyBlock
  }

  /**
   * Subclass-specific check for would-be child validity. Subclasses that want
   * to perform checks should override this, and either return `false` or throw
   * an error to indicate a problem. By default, this method always returns
   * `true`.
   *
   * @param {IntfComponent} child Would-be child component.
   * @returns {boolean} `true` if `child` is acceptable as a child of this
   *   instance, or `false` if not.
   */
  async _impl_isChildAllowed(child) { // eslint-disable-line no-unused-vars
    return true;
  }
}
