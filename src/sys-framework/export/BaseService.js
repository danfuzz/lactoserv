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
   * @throws {Error} Any error thrown while handling the event. (That is, errors
   *   are not suppressed.)
   */
  async handleEvent(payload) {
    try {
      const result = await this._impl_handleEvent(payload);

      if (typeof result !== 'boolean') {
        // Caught, logged, and rethrown immediately below.
        throw BaseService.#makeResultError(payload, result);
      }

      return result;
    } catch (e) {
      this.logger?.threw(e);
      throw e;
    }
  }

  /**
   * Sends an event to this instance. This simply wraps up the arguments in
   * a payload object, and hands them to {@link #handleEvent}.
   *
   * @param {string} type The event type.
   * @param {...*} args Arbitrary event arguments.
   * @returns {boolean} `true` if this instance handled the event, or `false` if
   *   not.
   * @throws {Error} Any error thrown while handling the event. (That is, errors
   *   are not suppressed.)
   */
  async send(type, ...args) {
    return this.handleEvent(new EventPayload(type, ...args));
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
    if (!this[handlerName]) {
      return false;
    }

    const result = await this[handlerName](...payload.args);

    if (typeof result !== 'boolean') {
      // Caught, logged, and rethrown in `handleEvent()` above.
      throw BaseService.#makeResultError(handlerName, result);
    }

    return result;
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
   * Makes an `Error` for an invalid handler result.
   *
   * @param {EventPayload|string} methodOrPayload The name of the method or the
   *   event type was problematic.
   * @param {*} result The result of the call to the method.
   * @returns {Error} The error to throw.
   */
  static #makeResultError(methodOrPayload, result) {
    const verbPhrase = (result === undefined)
      ? 'returned `undefined`. Maybe missing a `return` statement?'
      : 'did not return a `boolean`.';

    const methodStr = (methodOrPayload instanceof EventPayload)
      ? `_impl_handleEvent({ type: '${methodOrPayload.type}' })`
      : `${methodOrPayload}()`;

    return new Error(`${methodStr} ${verbPhrase}`);
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
