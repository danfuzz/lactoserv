// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { EventPayload, EventSource } from '@this/async';
import { IntfDeconstructable, Sexp } from '@this/decon';
import { Moment } from '@this/quant';
import { Chalk } from '@this/text';
import { MustBe } from '@this/typey';
import { BaseDefRef, BaseValueVisitor, StackTrace, VisitDef }
  from '@this/valvis';

import { LogTag } from '#x/LogTag';


/**
 * Always-on `Chalk` instance.
 *
 * @type {Chalk}
 */
const chalk = Chalk.ON;

/**
 * The thing which is logged; it is the payload class used for events
 * constructed by this module. It includes the same basic event properties as
 * {@link EventPayload} (which it inherits from), to which it adds a few
 * logging-specific properties.
 *
 * @implements {IntfDeconstructable}
 */
export class LogPayload extends EventPayload {
  /**
   * Stack trace, if available.
   *
   * @type {?StackTrace}
   */
  #stack;

  /**
   * Moment in time that this instance represents.
   *
   * @type {Moment}
   */
  #when;

  /**
   * Tag.
   *
   * @type {LogTag}
   */
  #tag;

  /**
   * Constructs an instance.
   *
   * @param {?StackTrace} stack Stack trace associated with this instance, or
   *   `null` if not available.
   * @param {Moment} when Moment in time that this instance represents.
   * @param {LogTag} tag Tag for the instance, that is, component name and
   *   optional context.
   * @param {string} type "Type" of the instance, e.g. think of this as
   *   something like a constructor class name if log records could be "invoked"
   *   (which... they kinda might be able to be at some point).
   * @param {...*} args Arbitrary arguments of the instance, whose meaning
   *   depends on the type.
   */
  constructor(stack, when, tag, type, ...args) {
    super(type, ...args);

    this.#stack = (stack === null) ? null : MustBe.instanceOf(stack, StackTrace);
    this.#when  = MustBe.instanceOf(when, Moment);
    this.#tag   = MustBe.instanceOf(tag, LogTag);
  }

  /** @returns {?StackTrace} Stack trace, if available. */
  get stack() {
    return this.#stack;
  }

  /** @returns {LogTag} Tag. */
  get tag() {
    return this.#tag;
  }

  /** @returns {Moment} Moment in time that this instance represents. */
  get when() {
    return this.#when;
  }

  /** @override */
  deconstruct() {
    return new Sexp(LogPayload,
      this.#stack, this.#when, this.#tag, this.type, ...this.args);
  }

  /**
   * Gets a string representation of this instance intended for maximally-easy
   * human consumption.
   *
   * @param {boolean} [colorize] Colorize the result?
   * @returns {string} The "human form" string.
   */
  toHuman(colorize = false) {
    const whenString = this.#when.toString({ decimals: 4 });

    const parts = [
      colorize ? chalk.bold.blue(whenString) : whenString,
      ' ',
      this.#tag.toHuman(colorize),
      ' '
    ];

    this.#appendHumanPayload(parts, colorize);

    return parts.join('');
  }

  /**
   * Gets a plain object representing this instance. The result has named
   * properties for each of the properties available on instances, except that
   * `stack` is omitted if `this.stack` is `null`. Everything except `.args` on
   * the result is guaranteed to be JSON-encodable, and `.args` will be
   * JSON-encodable as long as `this.args` is, since they will be the exact
   * same object.
   *
   * @returns {object} The plain object representation of this instance.
   */
  toPlainObject() {
    return {
      ...(this.#stack ? { stack: this.#stack.frames } : {}),
      when: this.#when.toPlainObject(),
      tag:  this.#tag.allParts,
      type: this.type,
      args: this.args
    };
  }

  /**
   * Appends the human form of {@link #payload} to the given array of parts (to
   * ultimately `join()`).
   *
   * @param {Array<string>} parts Parts to append to.
   * @param {boolean} colorize Colorize the result?
   */
  #appendHumanPayload(parts, colorize) {
    const human = new LogPayload.#HumanVisitor(this, colorize).visitSync();
    parts.push(...human.flat(Number.POSITIVE_INFINITY));
  }


  //
  // Static members
  //

  /**
   * Colorizer function to use for defs and refs.
   *
   * @type {Function}
   */
  static #COLOR_DEF_REF = chalk.magenta.bold;

  /**
   * Colorizer function to use for top-level payload type and cladding.
   *
   * @type {Function}
   */
  static #COLOR_PAYLOAD = chalk.bold;

  /**
   * Colorizer function to use for {@link Sexp} type and cladding.
   *
   * @type {Function}
   */
  static #COLOR_SEXP = chalk.ansi256(130).bold; // Dark orange, more or less.

  /**
   * Moment to use for "kickoff" instances.
   *
   * @type {Moment}
   */
  static #KICKOFF_MOMENT = new Moment(0);

  /**
   * Default event type to use for "kickoff" instances.
   *
   * @type {string}
   */
  static #KICKOFF_TYPE = 'kickoff';

  /**
   * Default tag to use for "kickoff" instances.
   *
   * @type {LogTag}
   */
  static #KICKOFF_TAG = new LogTag('kickoff');

  /**
   * Constructs a minimal instance of this class, suitable for use as the
   * payload for a "kickoff" event passed to the {@link EventSource}
   * constructor.
   *
   * @param {?LogTag} [tag] Tag to use for the instance, or `null` to use a
   *   default.
   * @param {?string} [type] Type to use for the instance, or `null` to use a
   *   default.
   * @returns {LogPayload} A minimal instance for "kickoff."
   */
  static makeKickoffInstance(tag = null, type = null) {
    tag  ??= this.#KICKOFF_TAG;
    type ??= this.#KICKOFF_TYPE;
    return new LogPayload(null, this.#KICKOFF_MOMENT, tag, type);
  }

  /**
   * Visitor class which stringifies instances of this (outer) class and all its
   * components. This produces an array whose elements are either strings or
   * arrays (of strings or arrays of...), with the array nesting representing
   * the hierarchical structure of instance.
   */
  static #HumanVisitor = class HumanVisitor extends BaseValueVisitor {
    /**
     * Should the output be colorized?
     *
     * @type {boolean}
     */
    #colorize;

    /**
     * Constructs an instance.
     *
     * @param {*} value The value to visit.
     * @param {boolean} colorize Colorize the output?
     */
    constructor(value, colorize) {
      super(value);
      this.#colorize = colorize;
    }

    /** @override */
    _impl_visitArray(node) {
      return this.#visitAggregate(node, '[', ']', '[]');
    }

    /** @override */
    _impl_visitBigInt(node_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitBoolean(node) {
      return `${node}`;
    }

    /** @override */
    _impl_visitClass(node_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitError(node_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitFunction(node_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitInstance(node) {
      if (node instanceof LogPayload) {
        const color          = LogPayload.#COLOR_PAYLOAD;
        const { type, args } = node;
        if (args.length === 0) {
          // Avoid extra work in the easy zero-args case.
          const text = `${type}()`;
          return [this.#maybeColorize(text, color)];
        } else {
          const open  = this.#maybeColorize(`${type}(`, color);
          const close = this.#maybeColorize(')', color);
          return this.#visitAggregate(args, open, close, null);
        }
      } else if (node instanceof BaseDefRef) {
        const color  = LogPayload.#COLOR_DEF_REF;
        const result = [this.#maybeColorize(`#${node.index}`, color)];
        if (node instanceof VisitDef) {
          result.push(
            this.#maybeColorize(' = ', color),
            this._prot_visit(node.value).value);
        }
        return result;
      } else if (node instanceof Sexp) {
        const color                 = LogPayload.#COLOR_SEXP;
        const { functorName, args } = node;
        if (args.length === 0) {
          // Avoid extra work in the easy zero-args case.
          const text = `@${functorName}()`;
          return [this.#maybeColorize(text, color)];
        } else {
          const open  = this.#maybeColorize(`@${functorName}(`, color);
          const close = this.#maybeColorize(')', color);
          return this.#visitAggregate(args, open, close, null);
        }
      } else {
        throw this.#shouldntHappen();
      }
    }

    /** @override */
    _impl_visitNull() {
      return 'null';
    }

    /** @override */
    _impl_visitNumber(node) {
      return this.#maybeColorize(`${node}`, chalk.yellow);
    }

    /** @override */
    _impl_visitPlainObject(node) {
      return this.#visitAggregate(node, '{ ', ' }', '{}');
    }

    /** @override */
    _impl_visitProxy(node_unused, isFunction_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitString(node) {
      // `inspect()` to get good quoting, etc.
      return this.#maybeColorize(util.inspect(node), chalk.green);
    }

    /** @override */
    _impl_visitSymbol(node_unused) {
      throw this.#shouldntHappen();
    }

    /** @override */
    _impl_visitUndefined() {
      throw this.#shouldntHappen();
    }

    /**
     * Colorizes the given text, but only if this instance has been told to
     * colorize.
     *
     * @param {string} text The text in question.
     * @param {Function} func The colorizer function.
     * @returns {string} The colorized-or-not result.
     */
    #maybeColorize(text, func) {
      return this.#colorize ? func(text) : text;
    }

    /**
     * Renders an object key, quoting and colorizing as appropriate.
     *
     * @param {*} key The key.
     * @returns {string} The rendered form.
     */
    #renderKey(key) {
      if ((typeof key === 'string') && /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(key)) {
        // It doesn't have to be quoted.
        return key;
      } else {
        return this._impl_visitString(key);
      }
    }

    /**
     * Constructs a "shouldn't happen" error. This is used in the implementation
     * of all the `_impl_visit*()` methods corresponding to types that aren't
     * supposed to show up in a payload.
     *
     * @returns {Error} The error.
     */
    #shouldntHappen() {
      return new Error('Shouldn\'t happen.');
    }

    /**
     * Helper for various `_impl_visit*()` methods, which visits an aggregate
     * object of some sort.
     *
     * @param {*} node The aggregate to visit.
     * @param {string} open The "open" string.
     * @param {string} close The "close" string.
     * @param {string} ifEmpty The string to use to represent an empty
     *   instance.
     * @returns {Array<string>} The stringified aggregate, as an array.
     */
    #visitAggregate(node, open, close, ifEmpty) {
      const isArray = Array.isArray(node);
      const result  = [open];
      let   first   = true;
      let   inProps = !isArray;

      const initialVisit = isArray
        ? this._prot_visitArrayProperties(node)
        : this._prot_visitObjectProperties(node);

      for (const [k, v] of Object.entries(initialVisit)) {
        if (!inProps && (k === 'length')) {
          inProps = true;
          continue;
        } else if (first) {
          first = false;
        } else {
          result.push(', ');
        }

        if (inProps) {
          result.push(this.#renderKey(k), ': ');
        }

        result.push(v);
      }

      if (result.length === 1) {
        return [ifEmpty];
      } else {
        result.push(close);
        return result;
      }
    }
  };
}
