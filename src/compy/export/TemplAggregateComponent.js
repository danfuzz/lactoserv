// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Template component class which allows child components to be added to it as
 * part of its _public_ interface. (All components are allowed to add children
 * on their own behalf.)
 *
 * Concrete subclasses are allowed to define a check on would-be children, which
 * is called prior to the actual addition.
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplAggregateComponent = (className, superclass) => {
  MustBe.constructorFunction(superclass);
  MustBe.string(className);

  return class AggregateComponent extends superclass {
    // @defaultConstructor

    /**
     * Adds one or more children to this instance. Arguments can be either
     * component instances or _arrays_ of component instances.
     *
     * @param {...BaseComponent|Array<BaseComponent>} children Components to
     *   add.
     */
    async addChildren(...children) {
      const flat = children.flat(1);

      for (const child of flat) {
        if (!await this._impl_isChildAllowed(child)) {
          throw new Error(`Child cannot be added: ${child}`);
        }
      }

      for (const child of flat) {
        await this._impl_addChild(child);
        await this._prot_addChild(child);
      }
    }

    /**
     * Subclass-specific behavior for adding a child. Subclasses that want to do
     * anything extra when adding a child should override this. This method is
     * called _after_ the call to {@link #_impl_isChildAllowed} and _before_ the
     * call to {@link #_prot_addChild} on the base class. By default, this
     * method does nothing.
     *
     * @param {BaseComponent} child Child component.
     */
    async _impl_addChild(child) { // eslint-disable-line no-unused-vars
      // @emptyBlock
    }

    /**
     * Subclass-specific check for would-be child validity. Subclasses that want
     * to perform checks should override this, and either return `false` or
     * throw an error to indicate a problem. By default, this method always
     * returns `true`.
     *
     * @param {BaseComponent} child Would-be child component.
     * @returns {boolean} `true` if `child` is acceptable as a child of this
     *   instance, or `false` if not.
     */
    async _impl_isChildAllowed(child) { // eslint-disable-line no-unused-vars
      return true;
    }
  };
};
