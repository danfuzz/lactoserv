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
  #dispatchLoggerObj = false;

  // @defaultConstructor

  /**
   * Gets a dispatch logger to use for either a new dispatch or a
   * dispatch-in-progress. If given a non-`null` logger for `base`, this will
   * augment it with this instance's `name`. Otherwise, if this instance is
   * itself configured with `dispatchLogging: true`, this will return a
   * sub-logger of _this_ logger with either the given string `base` for the ID
   * or a newly- generated dispatch ID (if `base` is `null`). Otherwise, this
   * returns `null`.
   *
   * @param {?IntfLogger|string} [base] Logger to base the result on, string ID
   *   to use, or `null` if neither of this is available..
   * @returns {?IntfLogger} Logger to use for a specific dispatch cycle, or
   *   `null` not to log it.
   */
  _prot_newDispatchLogger(base = null) {
    if (base === null) {
      return this.#dispatchLogger?.$newId ?? null;
    } else if (typeof base === 'string') {
      return this.#dispatchLogger?.[base] ?? null;
    } else {
      return base[this.name];
    }
  }

  /**
   * @returns {?IntfLogger} The base sub-logger to use for dispatch logging, or
   * `null` if this instance isn't configured to initiate dispatch logging.
   */
  get #dispatchLogger() {
    if (this.#dispatchLoggerObj === false) {
      this.#dispatchLoggerObj = this.config.dispatchLogging
        ? this.logger?.dispatch ?? null
        : null;
    }

    return this.#dispatchLoggerObj;
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
