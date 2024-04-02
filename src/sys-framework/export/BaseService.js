// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventPayload } from '@this/async';
import { BaseClassedConfig, BaseComponent } from '@this/compote';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  // @defaultConstructor

  /**
   * Handles a service event of some sort. All calls from the framework into a
   * running service are made using this method, which in turn calls through to
   * {@link #_impl_handleEvent}, which by default further calls through to
   * event-specific `_impl_handleEvent_<eventType>()` methods. It is up to
   * subclasses to override either {@link #_impl_handleEvent} or the
   * event-type-specific methods.
   *
   * **Note:** When an event-type-specific method is called, it is passed the
   * payload arguments directly as arguments, and not just a single payload
   * object argument.
   *
   * @param {EventPayload} payload The event payload.
   * @returns {boolean} `true` if this instance handled the event, or `false` if
   *   not.
   */
  async handleEvent(payload) {
    try {
      const result = await this._impl_handleEvent(payload);
      if (typeof result !== 'boolean') {
        // Caught, logged, and rethrown immediately below.
        if (result === undefined) {
          throw new Error('`_impl_handleEvent()` returned `undefined`. Maybe missing a `return` statement?');
        } else {
          throw new Error('`_impl_handleEvent()` did not return a `boolean`.');
        }
      }
      return result;
    } catch (e) {
      this.logger?.threw(e);
      throw e;
    }
  }

  /**
   * Subclass-specific service any-event handler. By default this tries to
   * dispatch to an instance method named `_impl_handleEvent_<eventType>()`, but
   * subclasses that want to do general event handling across types can just
   * override this method.
   *
   * @param {EventPayload} payload The event payload.
   * @returns {boolean} `true` if this instance handled the event, or `false` if
   *   not.
   */
  async _impl_handleEvent(payload) {
    const handlerName = BaseService.#handlerFromType(payload.type);

    // Note: We can't call the possibly-unimplemented-handler using `?.` because
    // that wouldn't let us distinguish between unimplemented and implemented
    // when the implemented method mistakenly failed to return a value (or
    // returned `undefined` explicitly).
    return this[handlerName]
      ? await this[handlerName](...payload.args)
      : false;
  }


  //
  // Static members
  //

  /**
   * Map from event types to corresponding type-specific handler names, lazily
   * generated.
   *
   * @type {Map<string, string>}
   */
  static #EVENT_TYPE_TO_HANDLER_MAP = new Map();

  /** @override */
  static _impl_configClass() {
    return BaseService.Config;
  }

  /**
   * Gets the type-specific handler name for the given event type.
   *
   * @param {string} type The event type.
   * @returns {string} The type-specific event handler name.
   */
  static #handlerFromType(type) {
    const already = this.#EVENT_TYPE_TO_HANDLER_MAP.get(type);

    if (already) {
      return already;
    }

    const result = `_impl_handleEvent_${type}`;

    this.#EVENT_TYPE_TO_HANDLER_MAP.set(type, result);
    return result;
  }

  /**
   * Default configuration subclass for this (outer) class, which adds no
   * options beyond `class`.
   *
   * This class only really exists to be an easy target to use when subclasses
   * want to define configuration classes in the usual way, without having to
   * remember the persnickety detail of which actual class in the `compote`
   * module is the most appropriate one to derive from.
   */
  static Config = class Config extends BaseClassedConfig {
    // @defaultConstructor
  };
}
