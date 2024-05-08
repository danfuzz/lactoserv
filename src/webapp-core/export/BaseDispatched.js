// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { BaseComponent } from '@this/compy';
import { IntfLogger } from '@this/loggy-intf';
import { MustBe } from '@this/typey';


/**
 * Base class for components which have any sort of "dispatch" behavior,
 * specifically dispatch behavior that can be logged.
 */
export class BaseDispatched extends BaseComponent {
  /**
   * The dispatch logger, `null` if not to be done, or `false` if not yet set
   * up. (`false` because `null` is meaningful and shows more intent than
   * `undefined`).
   *
   * @type {?IntfLogger|false}
   */
  #dispatchLogger = false;

  // @defaultConstructor

  /**
   * @returns {?IntfLogger} The logger to use for dispatch-related logging, or
   * `null` if that sort of logging shouldn't be done.
   */
  get _prot_dispatchLogger() {
    if (this.#dispatchLogger !== false) {
      return this.#dispatchLogger;
    }

    this.#dispatchLogger = this.config.dispatchLogging
      ? this.logger?.dispatch
      : null;

    return this.#dispatchLogger;
  }

  /**
   * Gets a dispatch sub-logger with a new ID, or `null` if this instance is not
   * doing dispatch logging.
   *
   * @returns {?IntfLogger} Logger to use for a specific dispatch cycle, or
   *   `null` not to log it.
   */
  _prot_newDispatchLogger() {
    return this._prot_dispatchLogger?.$newId;
  }


  //
  // Static members
  //

  /** @override */
  static _impl_configClass() {
    return class Config extends super.prototype.constructor.CONFIG_CLASS {
      // @defaultConstructor

      /**
       * Indicates whether dispatch logging should be done.
       *
       * @param {boolean} [value] Proposed configuration value. Default `false`.
       * @returns {boolean} Accepted configuration value.
       */
      _config_dispatchLogging(value = false) {
        return MustBe.boolean(value);
      }
    };
  }
}
