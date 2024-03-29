// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger } from '@this/loggy-intf';
import { Methods } from '@this/typey';

import { ControlContext } from '#x/ControlContext';


/**
 * Interface for controllable components which live in a tree-ish arrangement
 * with other such components.
 *
 * TLDR: Concrete implementations (a) have an associated context, and (b) have a
 * set of lifecycle methods.
 *
 * @interface
 */
export class IntfComponent {
  /**
   * @returns {?ControlContext} Associated context, or `null` if not yet set up.
   */
  get context() {
    throw Methods.abstract();
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    throw Methods.abstract();
  }

  /** @returns {?string} Component name, or `null` if it does not have one. */
  get name() {
    throw Methods.abstract();
  }

  /**
   * Initializes this instance, indicating it is now linked to the given
   * context.
   *
   * @param {ControlContext} context Context that indicates this instance's
   *   active environment.
   * @param {boolean} [isReload] Is this action due to an in-process reload?
   */
  async init(context, isReload = false) {
    Methods.abstract(context, isReload);
  }

  /**
   * Starts this instance. It is only valid to call this after {@link #init} has
   * been called, _except_ if this instance is the root, in which case this
   * method will call {@link #init} itself before doing the start-per-se.
   *
   * @param {boolean} [isReload] Is this action due to an in-process reload?
   */
  async start(isReload = false) {
    Methods.abstract(isReload);
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped.
   *
   * @param {boolean} [willReload] Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload = false) {
    Methods.abstract(willReload);
  }
}
