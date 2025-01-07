// Copyright 2022-2025 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import * as util from 'node:util';

import { Sexp } from '@this/sexp';
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
 * arrays (of strings or arrays of...), with the array nesting representing the
 * hierarchical structure of instance.
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
    return this.#visitAggregate(node, '[', ']');
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
      const whenText = this.#maybeStyle(when.toJustSecs({ decimals: 4 }), HumanVisitor.#STYLE_WHEN);
      const tagText  = tag.toHuman(this.#styled);
      const callText = this.#visitCall(type, args, HumanVisitor.#STYLE_PAYLOAD);

      return new ComboText(
        whenText, ComboText.INDENT, ComboText.SPACE,
        tagText, ComboText.SPACE, callText);
    } else if (node instanceof BaseDefRef) {
      const style  = HumanVisitor.#STYLE_DEF_REF;
      const result = [this.#maybeStyle(`#${node.index}`, style)];
      if (node instanceof VisitDef) {
        result.push(
          this.#maybeStyle(' = ', style),
          ComboText.INDENT,
          this._prot_visitSync(node.value));
      }
      return new ComboText(...result);
    } else if (node instanceof Sexp) {
      return this.#renderSexp(node);
    } else {
      throw this.#shouldntHappen();
    }
  }

  /** @override */
  _impl_visitNull() {
    return this.#maybeStyle('null', HumanVisitor.#STYLE_NULL);
  }

  /** @override */
  _impl_visitNumber(node) {
    return this.#maybeStyle(`${node}`, HumanVisitor.#STYLE_NUMBER);
  }

  /** @override */
  _impl_visitPlainObject(node) {
    return this.#visitAggregate(node, '{', '}', true);
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
  _impl_visitSymbol(node_unused, isInterned_unused) {
    throw this.#shouldntHappen();
  }

  /** @override */
  _impl_visitUndefined() {
    throw this.#shouldntHappen();
  }

  /**
   * Styles the given text, but only if this instance has been told to be styled
   * _and_ the given style function is passed as non-`null`.
   *
   * @param {string} text The text in question.
   * @param {?Function} func The style/colorizer function, or `null` if no style
   *   should be applied.
   * @returns {string} The styled-or-not result.
   */
  #maybeStyle(text, func) {
    return (func && this.#styled)
      ? new StyledText(func(text), text.length)
      : text;
  }

  /**
   * Renders a sexp representing a function or class object.
   *
   * @param {Sexp} sexp The instance to render.
   * @param {boolean} isClass Is this a class?
   * @returns {TypeText} The rendered form.
   */
  #renderFunctionOrClass(sexp, isClass) {
    const name     = sexp.args[0];
    const style    = isClass ? HumanVisitor.#STYLE_CLASS : HumanVisitor.#STYLE_FUNCTION;
    const label    = isClass ? 'class' : 'function';
    const fullName = name ? `${label} ${name}` : label;

    return [
      this.#maybeStyle(`${fullName}`, style),
      ' ',
      this.#maybeStyle('{...}', HumanVisitor.#STYLE_ELIDED)
    ].join('');
  }

  /**
   * Renders an object key, quoting and colorizing as appropriate.
   *
   * @param {*} key The key.
   * @returns {TypeText} The rendered form.
   */
  #renderKey(key) {
    if (typeof key === 'string') {
      if (/^([$_a-zA-Z][$_a-zA-Z0-9]*|[1-9][0-9]{0,15}|0)$/.test(key)) {
        // It doesn't have to be quoted.
        return `${key}:`;
      } else if (/^-[1-9][0-9]{0,15}$/.test(key)) {
        // It can be treated like a negative numeric literal.
        return `[${key}]:`;
      } else {
        // It needs to be quoted.
        return `${util.inspect(key)}:`;
      }
    } else {
      // A non-string, perhaps a symbol, however as of this writing this case
      // isn't used.
      return new ComboText(
        '[', ComboText.NO_BREAK,
        this._prot_visitSync(key),
        ComboText.NO_BREAK, ']:');
    }
  }

  /**
   * Renders a {@link Sexp}.
   *
   * @param {Sexp} sexp The instance to render.
   * @returns {TypeText} The rendered form.
   */
  #renderSexp(sexp) {
    const { functor, args } = sexp;
    let   name              = functor;

    if (functor instanceof Sexp) {
      switch (functor.functor) {
        case 'Class':
        case 'Function': {
          name = functor.args[0];
          break;
        }
        default: {
          name = functor.functorName;
          break;
        }
      }
    } else if (typeof functor === 'string') {
      switch (functor) {
        case 'BigInt': {
          const str = `${args[0]}n`;
          return this.#maybeStyle(str, HumanVisitor.#STYLE_NUMBER);
        }
        case 'Class': {
          return this.#renderFunctionOrClass(sexp, true);
        }
        case 'Elided': {
          return this.#maybeStyle('...', HumanVisitor.#STYLE_ELIDED);
        }
        case 'Function': {
          return this.#renderFunctionOrClass(sexp, false);
        }
        case 'Symbol': {
          const funcStr = args[1] ? 'Symbol.for' : 'Symbol';
          const symArgs = (args[0] === null) ? [] : [args[0]];
          return this.#visitCall(funcStr, symArgs);
        }
        case 'Undefined': {
          return this.#maybeStyle('undefined', HumanVisitor.#STYLE_UNDEFINED);
        }
      }
    }

    return this.#visitCall(`@${name}`, args, HumanVisitor.#STYLE_SEXP);
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
   * @param {string} open The "open" bracket text.
   * @param {string} close The "close" bracket text.
   * @param {boolean} [spaceBrackets] Use spaces inside the bracket text, when
   *   non-empty (and on a single line)?
   * @returns {TypeText} The rendered aggregate.
   */
  #visitAggregate(node, open, close, spaceBrackets = false) {
    const isArray    = Array.isArray(node);
    const innerVisit = this._prot_visitProperties(node, true);

    // If it's an array, it has a `length` property.
    const propCount = innerVisit.length - (isArray ? 1 : 0);

    if ((propCount === 0) && !(isArray && (node.length !== 0))) {
      // Avoid a lot of work to produce an empty-aggregate result.
      return `${open}${close}`;
    }

    const parts   = [];
    let   isFirst = true;
    let   inProps = !isArray;
    let   arrayIdx = 0;

    const maybeComma = () => {
      if (isFirst) {
        isFirst = false;
      } else {
        parts.push(ComboText.NO_BREAK, ',', ComboText.SPACE);
      }
    };

    for (const [k, v] of innerVisit) {
      if (isArray && (k === 'length')) {
        if (node.length !== arrayIdx) {
          // There was some sparseness at the end of the array.
          maybeComma();
          parts.push('[length]:', ComboText.SPACE, v);
        }
        inProps = true;
        continue;
      }

      maybeComma();

      let impliedKey = false;
      if (inProps) {
        parts.push(ComboText.BREAK, this.#renderKey(k), ComboText.SPACE);
      } else if (k === `${arrayIdx}`) {
        // We got the expected (non-sparse) array index.
        arrayIdx++;
        impliedKey = true;
      } else {
        // We just skipped over some indexes in a sparse array.
        parts.push(`[${k}]:`, ComboText.SPACE);
        arrayIdx = Number.parseInt(k) + 1;
      }

      if (impliedKey) {
        parts.push(v);
      } else if (v[HumanVisitor.#SYM_isIndentedValue]) {
        parts.push(ComboText.NO_BREAK, v);
      } else {
        // What's going on: The rendered value we're about to append _isn't_ a
        // complex indented value (object, sexp, etc.), and if it won't fit on
        // the same line as the key, we _do_ want to have it indented from the
        // key.
        parts.push(ComboText.INDENT, v, ComboText.OUTDENT);
      }
    }

    const maybeSpace = spaceBrackets ? [ComboText.SPACE] : [];
    const result = new ComboText(
      open, ...maybeSpace, ComboText.BREAK,
      ComboText.INDENT, ...parts, ComboText.OUTDENT,
      ComboText.BREAK, ...maybeSpace, close);

    result[HumanVisitor.#SYM_isIndentedValue] = true;
    return result;
  }

  /**
   * Visits a call-like thing which has a functor-ish thing and optional
   * arguments.
   *
   * @param {string} funcString The string form of the functor or functor-like
   *   thing.
   * @param {Array} args The arguments.
   * @param {?Function} [claddingStyle] The styler for the "cladding" (name and
   *   parens), or `null` if none.
   * @returns {TypeText} The rendered form.
   */
  #visitCall(funcString, args, claddingStyle = null) {
    if (args.length === 0) {
      // Avoid extra work in the easy zero-args case.
      const text = `${funcString}()`;
      return this.#maybeStyle(text, claddingStyle);
    }

    const open  = this.#maybeStyle(`${funcString}(`, claddingStyle);
    const close = this.#maybeStyle(')', claddingStyle);
    const parts = [open, ComboText.INDENT];

    for (let at = 0; at < args.length; at++) {
      const arg    = this._prot_visitSync(args[at]);
      const isLast = (at === (args.length - 1));
      if (at !== 0) {
        parts.push(ComboText.SPACE);
      }
      parts.push(arg, ComboText.NO_BREAK, isLast ? close : ',');
    }

    const result = new ComboText(...parts);

    result[HumanVisitor.#SYM_isIndentedValue] = true;
    return result;
  }


  //
  // Static members
  //

  /**
   * Symbol for property added to instances of {@link ComboText}, to indicate
   * that they were produced by this class's complex indented value rendering
   * methods.
   *
   * @type {symbol}
   */
  static #SYM_isIndentedValue = Symbol('HumanVisitor.isIndentedValue');

  /**
   * Styling function to use for defs and refs.
   *
   * @type {Function}
   */
  static #STYLE_DEF_REF = chalk.magenta.bold;

  /**
   * Styling function to use for class objects.
   *
   * @type {Function}
   */
  static #STYLE_CLASS = chalk.blue.bold;

  /**
   * Styling function to use for the "elided" value, rendered as `...`.
   *
   * @type {Function}
   */
  static #STYLE_ELIDED = chalk.dim;

  /**
   * Styling function to use for functions.
   *
   * @type {Function}
   */
  static #STYLE_FUNCTION = chalk.blue.bold;

  /**
   * Styling function to use for the value `null`.
   *
   * @type {Function}
   */
  static #STYLE_NULL = chalk.ansi256(240).bold;

  /**
   * Styling function to use for numbers (including bigints).
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
   * Styling function to use for the value `undefined`.
   *
   * @type {Function}
   */
  static #STYLE_UNDEFINED = chalk.ansi256(240).bold;

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

  /**
   * Gets a full-length unabbreviated string corresponding to the given
   * instance's {@link #when}.
   *
   * @param {LogPayload} payload The instance in question.
   * @param {boolean} [styled] Should the result be styled/colorized?
   * @returns {string} The full-length when string.
   */
  static whenStringFrom(payload, styled) {
    const whenText = payload.when.toString({ decimals: 4, colons: true, dashes: true, middleUnderscore: false });

    return styled
      ? HumanVisitor.#STYLE_WHEN(whenText)
      : whenText;
  }
}
