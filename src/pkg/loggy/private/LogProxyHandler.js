// Copyright 2022 the Lactoserv Authors (Dan Bornstein et alia).
// This project is PROPRIETARY and UNLICENSED.

import { PropertyCacheProxyHandler } from '@this/metacomp';

import { BaseLoggingEnvironment } from '#x/BaseLoggingEnvironment';
import { LogTag } from '#x/LogTag';


/**
 * Proxy handler which provides the illusion of an object with infinitely many
 * properties, each of which is callable as a function or a method, _or_ which
 * can be treated as an object with subproperties to add layers of tag context.
 * See {@link Loggy.loggerFor} for details (and the public interface to this
 * class).
 */
export class LogProxyHandler extends PropertyCacheProxyHandler {
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
   * @type {?LogTag} The tag to use for instances directly "under" this one, if
   * already computed.
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
   * @param {BaseLoggingEnvironment} environment Logging environment to use.
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
        this.#environment.emit(this.#tag, this.#typeOrNextTag, ...args);
      } else {
        this.#environment.emit(this.#tag, ...args);
      }
    } else {
      // We are being called as a regular function, not a method, so the first
      // argument is going to be the type.
      this.#environment.emit(this.#subTag, ...args);
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
      case LogProxyHandler.#METHOD_NAME_META: {
        return new LogProxyHandler.Meta(this);
      }
      case LogProxyHandler.#METHOD_NAME_NEW_ID: {
        const idTag = this.#subTag.withAddedContext(this.#environment.makeId());
        const proxy = LogProxyHandler.makeFunctionProxy(idTag, null, this.#environment);
        return PropertyCacheProxyHandler.noCache(proxy);
      }
      default: {
        return LogProxyHandler.makeFunctionProxy(this.#subTag, name, this.#environment);
      }
    }
  }


  //
  // Static members
  //

  /** @type {string} Method name for requesting metainformation. */
  static #METHOD_NAME_META = '$meta';

  /** @type {string} Method name to indicate dynamic ID construction. */
  static #METHOD_NAME_NEW_ID = '$newId';

  /** @type {string} Main tag name to use for the top level. */
  static #TOP_TAG_NAME = '(top)';

  /**
   * Metainformation about a logger. Instances of this class are returned when
   * accessing the property `$meta` on logger instances.
   */
  static Meta = class Meta {
    /** @type {LogProxyHandler} The subject handler instance. */
    #handler;

    /**
     * Constructs an instance.
     *
     * @param {LogProxyHandler} handler The subject handler instance.
     */
    constructor(handler) {
      this.#handler = handler;
    }

    /** @returns {string} Convenient accessor for `this.tag().lastContext`. */
    get lastContext() {
      return this.tag.lastContext;
    }

    /** @returns {LogTag} The tag used by the logger. */
    get tag() {
      return this.#handler.#tag;
    }

    /**
     * Gets newly-generated ID from this instance's logging environment.
     *
     * @returns {string} The new ID.
     */
    makeId() {
      return this.#handler.#environment.makeId();
    }
  };

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
