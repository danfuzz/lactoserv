// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { Sexp } from '@this/decon';
import { Chalk, ComboText, IndentedText, StyledText, TypeText }
  from '@this/texty';
import { BaseDefRef, BaseValueVisitor, VisitDef } from '@this/valvis';

import { LogPayload } from '#x/LogPayload';

/**
 * Always-on `Chalk` instance.
 *
 * @type {Chalk}
 */
const chalk = Chalk.ON;

/**
 * Visitor class which stringifies instances of {@link LogPayload} and all its
 * components. This produces an array whose elements are either strings or
 * arrays (of strings or arrays of...), with the array nesting representing
 * the hierarchical structure of instance.
 */
export class HumanVisitor extends BaseValueVisitor {
  /**
   * Should the output be styled/colorized?
   *
   * @type {boolean}
   */
  #styled;

  /**
   * Constructs an instance.
   *
   * @param {*} value The value to visit.
   * @param {boolean} styled Should the output be styled/colorized?
   */
  constructor(value, styled) {
    super(value);
    this.#styled = styled;
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
      const { tag, when, type, args } = node;
      const prefix = [
        this.#maybeColorize(when.toString({ decimals: 4 }), HumanVisitor.#COLOR_WHEN),
        ' ',
        tag.toHuman(this.#styled),
        ' '
      ];

      const color = HumanVisitor.#COLOR_PAYLOAD;

      if (args.length === 0) {
        // Avoid extra work in the easy zero-args case.
        const text = `${type}()`;
        return new ComboText(...prefix, this.#maybeColorize(text, color));
      } else {
        const open  = this.#maybeColorize(`${type}(`, color);
        const close = this.#maybeColorize(')', color);
        return new ComboText(...prefix, this.#visitAggregate(args, open, close, null));
      }
    } else if (node instanceof BaseDefRef) {
      const color  = HumanVisitor.#COLOR_DEF_REF;
      const result = [this.#maybeColorize(`#${node.index}`, color)];
      if (node instanceof VisitDef) {
        result.push(
          this.#maybeColorize(' = ', color),
          this._prot_visit(node.value).value);
      }
      return new ComboText(...result);
    } else if (node instanceof Sexp) {
      const color                 = HumanVisitor.#COLOR_SEXP;
      const { functorName, args } = node;
      if (args.length === 0) {
        // Avoid extra work in the easy zero-args case.
        const text = `@${functorName}()`;
        return this.#maybeColorize(text, color);
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
    return this.#maybeColorize(`${node}`, HumanVisitor.#COLOR_NUMBER);
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
    return this.#maybeColorize(util.inspect(node), HumanVisitor.#COLOR_STRING);
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
   * Styles the given text, but only if this instance has been told to be
   * styled.
   *
   * @param {string} text The text in question.
   * @param {Function} func The colorizer function.
   * @returns {string} The styled-or-not result.
   */
  #maybeColorize(text, func) {
    return this.#styled
      ? new StyledText(func(text), text.length)
      : text;
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
   * @param {TypeText} open The "open" text.
   * @param {TypeText} close The "close" text.
   * @param {TypeText} ifEmpty The text to use to represent an empty instance.
   * @returns {TypeText} The rendered aggregate.
   */
  #visitAggregate(node, open, close, ifEmpty) {
    const result  = [];
    let   first   = true;
    let   inProps = !Array.isArray(node);

    const initialVisit = this._prot_visitProperties(node, true);

    for (const [k, v] of initialVisit) {
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

    if (first) {
      return ifEmpty;
    } else {
      return new ComboText(open, new IndentedText(...result), close);
    }
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
   * Colorizer function to use for numbers.
   *
   * @type {Function}
   */
  static #COLOR_NUMBER = chalk.yellow;

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
   * Colorizer function to use for strings (that is, quoted string values).
   *
   * @type {Function}
   */
  static #COLOR_STRING = chalk.green;

  /**
   * Colorizer function to use for `payload.when`.
   *
   * @type {Function}
   */
  static #COLOR_WHEN = chalk.bold.blue;

  /**
   * Implementation of {@link LogPayload#toHuman}.
   *
   * @param {LogPayload} payload The instance to render.
   * @param {boolean} [styled] Style/colorize the result?
   * @returns {string} The rendered "human form" string.
   */
  static payloadToHuman(payload, styled = false) {
    const text = new HumanVisitor(payload, styled).visitSync();

    return text.toString();
  }
}
