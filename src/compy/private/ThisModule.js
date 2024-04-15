// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0


/**
 * Intramodule communication (un-exported).
 */
export class ThisModule {
  /**
   * Symbol used for the module-private getter `contextTree`.
   *
   * @type {symbol}
   */
  static SYM_contextTree = Symbol('compy.contextTree');

  /**
   * Symbol used for the module-private method `linkRoot`.
   *
   * @type {symbol}
   */
  static SYM_linkRoot = Symbol('compy.linkRoot');

  /**
   * Symbol used for the module-private method `setState`.
   *
   * @type {symbol}
   */
  static SYM_setState = Symbol('compy.setState');
}
