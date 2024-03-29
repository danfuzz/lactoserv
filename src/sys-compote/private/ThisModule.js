// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * Symbol used for the module-private method `addDescendant`.
   *
   * @type {symbol}
   */
  static SYM_addDescendant = Symbol('sys-framework.addDescendant');

  /**
   * Symbol used for the module-private method `linkRoot`.
   *
   * @type {symbol}
   */
  static SYM_linkRoot = Symbol('sys-framework.linkRoot');
}
