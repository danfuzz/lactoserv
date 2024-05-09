// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { IntfLogger, IntfLoggingEnvironment, LogTag } from '@this/loggy-intf';
import { PropertyCacheProxyHandler } from '@this/metacomp';

import { Loggy } from '#x/Loggy';


/**
 * Proxy handler which provides the illusion of an object with infinitely many
 * properties, each of which is callable as a function or a method, _or_ which
 * can be treated as an object with subproperties to add layers of tag context.
 * See {@link IntfLogger} and {@link Loggy#loggerFor} for details.
 */
export class LogProxyHandler extends PropertyCacheProxyHandler {
  /**
   * Tag to use on all logged events.
   *
   * @type {LogTag}
   */
  #tag;

  /**
   * Type to use when emitting events, or the tag to append to the context, for
   * the next layer of proxy.
   *
   * @type {?string}
   */
  #typeOrNextTag;

  /**
   * Logging environment to use.
   *
   * @type {IntfLoggingEnvironment}
   */
  #environment;

  /**
   * The tag to use for instances directly "under" this one, if already
   * computed.
   *
   * @type {?LogTag}
   */
  #cachedSubTag = null;

  /**
   * Constructs an instance.
   *
   * **Note:** This constructor is only intended for internal use. Client code
   * should use {@link #makeInstance}.
   *
   * @param {LogTag} tag Tag to use.
   * @param {?string} typeOrNextTag Event type or next tag.
   * @param {IntfLoggingEnvironment} environment Logging environment to use.
   */
  constructor(tag, typeOrNextTag, environment) {
    super();

    this.#tag           = tag;
    this.#typeOrNextTag = typeOrNextTag;
    this.#environment   = environment;
  }

  /**
   * @returns {LogTag} The tag to use for instances directly "under" this one.
   */
  get #subTag() {
    if (!this.#cachedSubTag) {
      if (this.#typeOrNextTag) {
        if (   (this.#tag.main === LogProxyHandler.#TOP_TAG_NAME)
            && (this.#tag.context.length === 0)) {
          // There's no "real" tag to append to; use the next-tag as the main
          // (first) piece of context.
          this.#cachedSubTag = new LogTag(this.#typeOrNextTag);
        } else {
          // Unspecial case where we just add to the existing non-top context.
          this.#cachedSubTag = this.#tag.withAddedContext(this.#typeOrNextTag);
        }
      } else {
        // No "next" in this instance (we're at the root); just keep the
        // existing tag (which might be the artificial "top" one).
        this.#cachedSubTag = this.#tag;
      }
    }

    return this.#cachedSubTag;
  }

  /** @override */
  apply(target_unused, thisArg, args) {
    if (thisArg) {
      // We are being called as a method.
      if (this.#typeOrNextTag) {
        this.#environment.log(1, this.#tag, this.#typeOrNextTag, ...args);
      } else {
        this.#environment.log(1, this.#tag, ...args);
      }
    } else {
      // We are being called as a regular function, not a method, so the first
      // argument is going to be the type.
      this.#environment.log(1, this.#subTag, ...args);
    }
  }

  /**
   * Produces the property value -- typically a method implementation -- for the
   * given property name.
   *
   * @param {string|symbol} name The property name.
   * @returns {*} An appropriately-constructed property value.
   */
  _impl_valueFor(name) {
    if (typeof name === 'symbol') {
      throw new Error('Invalid name for logging method (symbols not allowed).');
    }

    switch (name) {
      case 'name': {
        // We have to treat `name` specially, because every logger proxy is a
        // proxy of a function, and all functions are supposed to have a fixed
        // `name` property.
        return 'IntfLogger';
      }
      case LogProxyHandler.#PROP_ENV: {
        return this.#environment;
      }
      case LogProxyHandler.#PROP_META: {
        return new LogProxyHandler.Meta(this);
      }
      case LogProxyHandler.#PROP_NEW_ID: {
        const idTag = this.#subTag.withAddedContext(this.#environment.makeId());
        const proxy = LogProxyHandler.makeFunctionInstanceProxy(
          IntfLogger, idTag, null, this.#environment);
        return PropertyCacheProxyHandler.noCache(proxy);
      }
      default: {
        return LogProxyHandler.makeFunctionInstanceProxy(
          IntfLogger, this.#subTag, name, this.#environment);
      }
    }
  }


  //
  // Static members
  //

  /**
   * Property name for requesting the logging environment.
   *
   * @type {string}
   */
  static #PROP_ENV = '$env';

  /**
   * Property name for requesting metainformation.
   *
   * @type {string}
   */
  static #PROP_META = '$meta';

  /**
   * Property name to indicate dynamic ID construction.
   *
   * @type {string}
   */
  static #PROP_NEW_ID = '$newId';

  /**
   * Main tag name to use for the top level.
   *
   * @type {string}
   */
  static #TOP_TAG_NAME = '(top)';

  /**
   * Metainformation about a logger. Instances of this class are returned when
   * accessing the property `$meta` on logger instances.
   */
  static Meta = class Meta extends IntfLogger.Meta {
    /**
     * The subject handler instance.
     *
     * @type {LogProxyHandler}
     */
    #handler;

    /**
     * Constructs an instance.
     *
     * @param {LogProxyHandler} handler The subject handler instance.
     */
    constructor(handler) {
      super();
      this.#handler = handler;
    }

    /** @override */
    get env() {
      return this.#handler.#environment;
    }

    /** @override */
    get lastContext() {
      return this.tag.lastContext;
    }

    /** @override */
    get tag() {
      // Note: This is the instance's (computed/cached) `subTag` and not its
      // `tag`, because the latter doesn't include the full context when the
      // instance is called as an object.
      return this.#handler.#subTag;
    }

    /** @override */
    makeId() {
      return this.env.makeId();
    }
  };

  /**
   * Constructs a usable logger instance -- that is, an instance of this class
   * wrapped in a proxy -- either for the top level (no context tag) or for an
   * arbitrary starting context.
   *
   * @param {?LogTag|string|Array<string>} tag Tag to use on all logged events,
   *   or constructor arguments for same. If `null`, the instance will have no
   *   context tag.
   * @param {IntfLoggingEnvironment} environment Logging environment to use.
   * @returns {IntfLogger} A logger, as described.
   */
  static makeInstance(tag, environment) {
    if (tag === null) {
      tag = new LogTag(this.#TOP_TAG_NAME);
    } else if (typeof tag === 'string') {
      tag = new LogTag(tag);
    } else if (tag instanceof LogTag) {
      // @emptyBlock
    } else {
      // Assume array of string. (The constructor will do a thorough check.)
      tag = new LogTag(...tag);
    }

    return this.makeFunctionInstanceProxy(IntfLogger, tag, null, environment);
  }
}
