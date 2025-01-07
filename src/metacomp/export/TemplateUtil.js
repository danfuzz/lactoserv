// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { MustBe } from '@this/typey';


/**
 * Helper for dealing with template / mixin classes.
 */
export class TemplateUtil {
  /**
   * Finishes the construction of the given template class. This modifies the
   * argument and returns it.
   *
   * @param {string} name Name of the class.
   * @param {function(new:*)} cls Class to finish up.
   * @returns {function(new:*)} `cls`.
   */
  static make(name, cls) {
    MustBe.string(name);
    MustBe.constructorFunction(cls);

    Reflect.defineProperty(cls, 'name', {
      configurable: false,
      writable:     false,
      value:        name
    });

    return cls;
  }
}
