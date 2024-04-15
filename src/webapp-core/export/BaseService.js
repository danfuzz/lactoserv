// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { EventPayload } from '@this/async';
import { BaseComponent, BaseConfig } from '@this/compy';


/**
 * Base class for system services.
 */
export class BaseService extends BaseComponent {
  // @defaultConstructor

  /**
   * Makes a service call on this instance, with the expectation that it must be
   * handled. This will throw an error if the call was not in fact handled.
   *
   * @param {string} name The call method name.
   * @param {...*} args Arbitrary event arguments.
   * @returns {*} Arbitrary result of the call. If the call was not handled,
   *   this should be the special value {@link #UNHANDLED}.
   * @throws {Error} Thrown if the call was not handled or if the call threw
   *   during handling.
   */
  async call(name, ...args) {
    const result = await this.handleCall(new EventPayload(name, ...args));

    if (result === BaseService.UNHANDLED) {
      throw new Error(`Call \`${name()}\` not handled.`);
    }

    return result;
  }

  /**
   * Handles a "non-event" service call of some sort. All calls from the
   * framework into a running service other than event reporting are made using
   * this method, which in turn calls through to {@link #_impl_handleCall},
   * which by default further calls through to call-specific
   * `_impl_handleCall_<methodName>()` methods. It is up to subclasses to
   * override either {@link #_impl_handleCall} or the name-specific methods.
   *
   * **Note:** When a name-specific method is called, it is passed the
   * payload arguments directly as arguments, and not just a single payload
   * object argument.
   *
   * @param {EventPayload} payload Event payload describing the call, with the
   *   event `type` corresponding to the method name.
   * @returns {*} Arbitrary result of the call. If the call was not handled,
   *   this should be the special value {@link #UNHANDLED}.
   * @throws {Error} Any error thrown while handling the call. (That is, errors
   *   are not suppressed.)
   */
  async handleCall(payload) {
    try {
      return await this._impl_handleCall(payload);
    } catch (e) {
      this.logger?.threw(e);
      throw e;
    }
  }

  /**
   * Handles a service event of some sort. All event-reporting calls from the
   * framework into a running service are made using this method, which in turn
   * calls through to {@link #_impl_handleEvent}, which by default further calls
   * through to event-specific `_impl_handleEvent_<eventType>()` methods. It is
   * up to subclasses to override either {@link #_impl_handleEvent} or the
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
   * Sends an event to this instance. This simply wraps up the arguments in a
   * payload object, and hands them to {@link #handleEvent}.
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
   * Subclass-specific service any-call handler. By default this tries to
   * dispatch to an instance method named `_impl_handleCall_<methodName>()`, but
   * subclasses that want to do general call handling across all methods can
   * just override this method.
   *
   * @param {EventPayload} payload The event payload representing the method
   *   call.
   * @returns {*} Arbitrary result of the call. If the call was not handled,
   *   this should be the special value {@link #UNHANDLED}.
   */
  async _impl_handleCall(payload) {
    const handlerName = BaseService.#callHandlerFromName(payload.type);

    // Note: We can't call the possibly-unimplemented-handler using `?.` because
    // that wouldn't let us distinguish between unimplemented and implemented
    // when the implemented method intentionally returned `undefined` (either
    // implicitly or explicitly).
    if (!this[handlerName]) {
      return BaseService.UNHANDLED;
    }

    return this[handlerName](...payload.args);
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
    const handlerName = BaseService.#eventHandlerFromType(payload.type);

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
   * Map from call method names to corresponding name-specific handler names,
   * lazily generated.
   *
   * @type {Map<string, string>}
   */
  static #CALL_NAME_TO_HANDLER_MAP = new Map();

  /**
   * Map from event types to corresponding type-specific handler names, lazily
   * generated.
   *
   * @type {Map<string, string>}
   */
  static #EVENT_TYPE_TO_HANDLER_MAP = new Map();

  /**
   * Value to return from {@link #UNHANDLED}.
   *
   * @type {symbol}
   */
  static #UNHANDLED_VALUE = Symbol('BaseService.UNHANDLED');

  /**
   * @returns {*} Special value returned from {@link #handleCall} which
   * indicates that a service instance did not handle a particular call.
   */
  static get UNHANDLED() {
    return BaseService.#UNHANDLED_VALUE;
  }

  /** @override */
  static _impl_configClass() {
    return BaseService.Config;
  }

  /**
   * Gets the name-specific call handler name for the given method name.
   *
   * @param {string} name The method name.
   * @returns {string} The name-specific event handler name.
   */
  static #callHandlerFromName(name) {
    const already = this.#CALL_NAME_TO_HANDLER_MAP.get(name);

    if (already) {
      return already;
    }

    const result = `_impl_handleCall_${name}`;

    this.#CALL_NAME_TO_HANDLER_MAP.set(name, result);
    return result;
  }

  /**
   * Gets the type-specific event handler name for the given event type.
   *
   * @param {string} type The event type.
   * @returns {string} The type-specific event handler name.
   */
  static #eventHandlerFromType(type) {
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
   * configuration option and requires its instances to have `name`.
   *
   * This class mostly exists to be an easy target to use when subclasses want
   * to define configuration classes in the usual way, without having to
   * remember the persnickety detail of which class in the `compy` module is
   * the most appropriate one to derive from.
   */
  static Config = class Config extends BaseConfig {
    /** @override */
    constructor(rawConfig) {
      super(rawConfig, true /* require `name` */);
    }
  };
}
