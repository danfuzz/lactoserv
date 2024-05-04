// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';

import { BaseComponent } from '#x/BaseComponent';


/**
 * Template class for root components, that is, for components which are meant
 * to be used as the root component for their hierarchies. This is a template
 * class in order to let concrete root classes use a direct superclass other
 * than just {@link BaseComponent} per se.
 *
 * TODO: This class doesn't actually do anything... yet.
 *
 * @param {string} className The name of the resulting class.
 * @param {function(new:*)} superclass The superclass to extend (inherit from).
 * @returns {function(new:*)} The instantiated template class.
 */
export const TemplRootComponent = (className, superclass) => {
  MustBe.constructorFunction(superclass);
  MustBe.string(className);

  return class RootComponent extends superclass {
    // @defaultConstructor

    //
    // Static members
    //

    /**
     * @returns {function(new:BaseComponent.Config)} The class {@link
     * #Config}.
     *
     * @override
     */
    static _impl_configClass() {
      return RootComponent.Config;
    }

    /**
     * Default configuration subclass for this (outer) class, which adds no
     * configuration options.
     */
    static Config = class Config extends superclass.CONFIG_CLASS {
      // @emptyBlock
    };
  };
};
