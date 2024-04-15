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
 * set of `_impl_*` methods for subclasses to fill in.
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

  /**
   * @returns {Array<function(new:object)>} Array of interface classes that this
   * class claims to implement. Always a frozen object.
   */
  get implementedInterfaces() {
    throw Methods.abstract();
  }

  /** @returns {?IntfLogger} Logger to use, or `null` to not do any logging. */
  get logger() {
    throw Methods.abstract();
  }

  /** @returns {string} Component name. */
  get name() {
    throw Methods.abstract();
  }

  /**
   * @returns {IntfComponent} The root component of the hierarchy that this
   * instance is in.
   */
  get root() {
    throw Methods.abstract();
  }

  /**
   * @returns {string} Current component state. One of:
   *
   * * `new` -- Not yet initialized, which also means not yet attached to a
   *   hierarchy.
   * * `stopped` -- Initialized but not running.
   * * `running` -- Currently running.
   */
  get state() {
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
   * Indicates whether this instance implements (or at least _claims_ to
   * implement) or is a subclass of all the given classes / interfaces.
   *
   * @param {...function(new:IntfComponent)} [classes] List of classes and/or
   *   interfaces which the result must be an instance of or implement
   *   (respectively).
   * @returns {boolean} `true` if this instance matches the given criteria, or
   *   `false` if not.
   */
  instanceOfAll(...classes) {
    throw Methods.abstract();
  }

  /**
   * Starts this instance. It is only valid to call this after {@link #init} has
   * been called, _except_ if this instance is the root, in which case this
   * method will call {@link #init} itself before doing the start-per-se. It is
   * also only valid to call this method if the instance is not already running.
   *
   * @param {boolean} [isReload] Is this action due to an in-process reload?
   */
  async start(isReload = false) {
    Methods.abstract(isReload);
  }

  /**
   * Stops this this instance. This method returns when the instance is fully
   * stopped. It is only valid to call this method if it is already running.
   *
   * @param {boolean} [willReload] Is this action due to an in-process reload
   *   being requested?
   */
  async stop(willReload = false) {
    Methods.abstract(willReload);
  }
}
