// Copyright 2016-2019 the Bayou Authors (Dan Bornstein et alia).
// Licensed AS IS and WITHOUT WARRANTY under the Apache License,
// Version 2.0. Details: <http://www.apache.org/licenses/LICENSE-2.0>

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogTag } from '#x/LogTag';

import { MethodCacheProxyHandler } from '@this/metacomp';


/**
 * Proxy handler which provides the illusion of an object with infinitely many
 * properties, each of which is callable as a method that can be used to emit a
 * structured-event log with the same name as the property, _or_ which can be
 * treated as an object with subproperties to add layers of tag context.
 *
 * For example:
 *
 * * `proxy.florp(1, 2, 3)` will cause an event of type `florp` to be logged
 *   with arguments `[1, 2, 3]`.
 * * `proxy.super.special.florp('yes')` will cause an event of type `florp` to
 *   be logged with arguments `['yes']` and with additional tag context
 *   `['super', 'special']`.
 */
export class LogProxyHandler extends MethodCacheProxyHandler {
  /** @type {LogTag} Tag to use on all logged events. */
  #tag;

  /**
   * @type {?string} Type to use when emitting events, or the tag to append to
   * the context, for the next layer of proxy.
   */
  #typeOrNextTag;

  /** @type {BaseLoggingEnvironment} Logging environment to use. */
  #environment;

  /**
   * Constructs an instance.
   *
   * **Note:** This constructor is only intended for internal use. Client code
   * should use {@link #makeInstance}.
   *
   * @param {LogTag} tag Tag to use.
   * @param {?string} typeOrNextTag Event type or next tag.
   * @param {BaseLoggingEnvironment} environment Logging environment to use.
   */
  constructor(tag, typeOrNextTag, environment) {
    super();

    this.#tag           = tag;
    this.#typeOrNextTag = typeOrNextTag;
    this.#environment   = environment;
  }

  /** @override */
  apply(target_unused, thisArg, args) {
    if (thisArg) {
      // We are being called as a method.
      if (this.#typeOrNextTag) {
        this.#environment.emit(this.#tag, this.#typeOrNextTag, ...args);
      } else {
        this.#environment.emit(this.#tag, ...args);
      }
    } else {
      // We are being called as a regular function, not a method, so the first
      // argument is going to be the type.
      if (this.#typeOrNextTag) {
        const tag = this.#tag.withAddedContext(this.#typeOrNextTag);
        this.#environment.emit(tag, ...args);
      } else {
        this.#environment.emit(this.#tag, ...args);
      }
    }
  }

  /**
   * Makes a method handler for the given method name.
   *
   * @param {string|symbol} name The method name.
   * @returns {function(...*)} An appropriately-constructed handler.
   */
  _impl_methodFor(name) {
    if (typeof name === 'symbol') {
      throw new Error('Invalid name for logging method (symbols not allowed).');
    }

    let subTag;

    if (this.#typeOrNextTag) {
      if (   (this.#tag.main === LogProxyHandler.#TOP_TAG_NAME)
          && (this.#tag.context.length === 0)) {
        // There's no "real" tag to append to; use the next-tag as the main
        // (first) context.
        subTag = new LogTag(this.#typeOrNextTag);
      } else {
        // Unspecial case where we just add to the existing non-top context.
        subTag = this.#tag.withAddedContext(this.#typeOrNextTag);
      }
    } else {
      // No "next" yet (we're at the root); just keep the existing tag (which
      // might be the artificial "top" one).
      subTag = this.#tag;
    }

    return LogProxyHandler.makeFunctionProxy(subTag, name, this.#environment);
  }


  //
  // Static members
  //

  /** {string} Main tag name to use for the top level. */
  static #TOP_TAG_NAME = '<top>';

  /**
   * Constructs a usable logger instance -- that is, an instance of this class
   * wrapped in a proxy -- either for the top level (no context tag) or for an
   * arbitrary starting context.
   *
   * @param {?LogTag|string|string[]} tag Tag to use on all logged events, or
   *   constructor arguments for same. If `null`, the instance will have no
   *   context tag.
   * @param {BaseLoggingEnvironment} environment Logging environment to use.
   * @returns {function(...*)} A logger, as described.
   */
  static makeInstance(tag, environment) {
    if (tag === null) {
      tag = new LogTag(this.#TOP_TAG_NAME);
    } else if (typeof tag === 'string') {
      tag = new LogTag(tag);
    } else if (tag instanceof LogTag) {
      // Nothing to do here.
    } else {
      // Assume array of string. (The constructor will do a thorough check.)
      tag = new LogTag(...tag);
    }

    return this.makeFunctionProxy(tag, null, environment);
  }
}
