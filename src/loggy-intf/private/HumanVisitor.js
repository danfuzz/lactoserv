// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { Sexp } from '@this/decon';
import { Chalk, ComboText, StyledText, TypeText } from '@this/texty';
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
      const whenText = this.#maybeStyle(when.toString({ decimals: 4 }), HumanVisitor.#STYLE_WHEN);
      const tagText  = tag.toHuman(this.#styled);
      const style    = HumanVisitor.#STYLE_PAYLOAD;

      let mainText;
      if (args.length === 0) {
        // Avoid extra work in the easy zero-args case.
        mainText = this.#maybeStyle(`${type}()`, style);
      } else {
        const open  = this.#maybeStyle(`${type}(`, style);
        const close = this.#maybeStyle(')', style);
        mainText = this.#visitAggregate(args, open, close, null);
      }

      return new ComboText(
        whenText, ComboText.INDENT, ' ', tagText, ' ', mainText);
    } else if (node instanceof BaseDefRef) {
      const style  = HumanVisitor.#STYLE_DEF_REF;
      const result = [this.#maybeStyle(`#${node.index}`, style)];
      if (node instanceof VisitDef) {
        result.push(
          this.#maybeStyle(' = ', style),
          ComboText.INDENT,
          this._prot_visit(node.value).value);
      }
      return new ComboText(...result);
    } else if (node instanceof Sexp) {
      const style                 = HumanVisitor.#STYLE_SEXP;
      const { functorName, args } = node;
      if (args.length === 0) {
        // Avoid extra work in the easy zero-args case.
        const text = `@${functorName}()`;
        return this.#maybeStyle(text, style);
      } else {
        const open  = this.#maybeStyle(`@${functorName}(`, style);
        const close = this.#maybeStyle(')', style);
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
    return this.#maybeStyle(`${node}`, HumanVisitor.#STYLE_NUMBER);
  }

  /** @override */
  _impl_visitPlainObject(node) {
    return this.#visitAggregate(node, '{', '}', '{}', true);
  }

  /** @override */
  _impl_visitProxy(node_unused, isFunction_unused) {
    throw this.#shouldntHappen();
  }

  /** @override */
  _impl_visitString(node) {
    // `inspect()` to get good quoting, etc.
    return this.#maybeStyle(util.inspect(node), HumanVisitor.#STYLE_STRING);
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
  #maybeStyle(text, func) {
    return this.#styled
      ? new StyledText(func(text), text.length)
      : text;
  }

  /**
   * Renders an object key, quoting and colorizing as appropriate.
   *
   * @param {*} key The key.
   * @returns {TypeText} The rendered form.
   */
  #renderKey(key) {
    if ((typeof key === 'string') && /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test(key)) {
      // It doesn't have to be quoted.
      return `${key}:`;
    } else {
      return new ComboText(this._impl_visitString(key), ':');
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
   * @param {TypeText} open The "open" bracket text.
   * @param {TypeText} close The "close" bracket text.
   * @param {TypeText} ifEmpty The text to use to represent an empty instance.
   * @param {boolean} [spaceBrackets] Use spaces inside the bracket text, when
   *   non-empty (and on a single line)?
   * @returns {TypeText} The rendered aggregate.
   */
  #visitAggregate(node, open, close, ifEmpty, spaceBrackets = false) {
    const result    = [];
    let   inProps   = !Array.isArray(node);
    let   prevValue = null; // Needed because of comma wrangling.

    const initialVisit = this._prot_visitProperties(node, true);

    for (const [k, v] of initialVisit) {
      if (!inProps && (k === 'length')) {
        inProps = true;
        continue;
      }

      if (prevValue) {
        // It's only now that we know we need to slap a comma onto the previous
        // value.
        result.push(new ComboText(prevValue, ','), ' ');
      }

      if (inProps) {
        result.push(ComboText.CLEAR, this.#renderKey(k), ' ');
      }

      prevValue = v;
    }

    if (prevValue) {
      const maybeSpace = spaceBrackets ? [' '] : [];
      return new ComboText(
        open, ...maybeSpace,
        ComboText.INDENT,
        ...result, prevValue,
        ComboText.OUTDENT,
        ...maybeSpace, ComboText.CLEAR, close);
    } else {
      return ifEmpty;
    }
  }


  //
  // Static members
  //

  /**
   * Styling function to use for defs and refs.
   *
   * @type {Function}
   */
  static #STYLE_DEF_REF = chalk.magenta.bold;

  /**
   * Styling function to use for numbers.
   *
   * @type {Function}
   */
  static #STYLE_NUMBER = chalk.yellow;

  /**
   * Styling function to use for top-level payload type and cladding.
   *
   * @type {Function}
   */
  static #STYLE_PAYLOAD = chalk.bold;

  /**
   * Styling function to use for {@link Sexp} type and cladding.
   *
   * @type {Function}
   */
  static #STYLE_SEXP = chalk.ansi256(130).bold; // Dark orange, more or less.

  /**
   * Styling function to use for strings (that is, quoted string values).
   *
   * @type {Function}
   */
  static #STYLE_STRING = chalk.green;

  /**
   * Styling function to use for `payload.when`.
   *
   * @type {Function}
   */
  static #STYLE_WHEN = chalk.bold.blue;

  /**
   * Implementation of {@link LogPayload#toHuman}.
   *
   * @param {LogPayload} payload The instance to render.
   * @param {boolean} [styled] Style/colorize the result?
   * @param {?number} [maxWidth] The desired maximum line width to aim for
   *   (though not necessarily achieved), or `null` to have no limit.
   * @returns {string} The rendered "human form" string.
   */
  static payloadToHuman(payload, styled = false, maxWidth = null) {
    const text     = new HumanVisitor(payload, styled).visitSync();
    const rendered = text.render({ maxWidth });

    return rendered.value;
  }
}
