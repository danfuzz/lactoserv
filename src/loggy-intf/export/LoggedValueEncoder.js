// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { AskIf } from '@this/typey';
import { BaseValueVisitor, ErrorUtil, StackTrace } from '@this/util';


/**
 * Standard way to encode values used in logged events, such that they become
 * (as close as is reasonable to) simple immutable data that can be
 * JSON-encoded. This is where, e.g., class instances (that aren't
 * special-cased) get converted into non-instance data (along the lines of
 * inspection).
 *
 * The main intended interface for this class is the static method
 * {@link #encode}, but it can also just be used directly as the concrete
 * visitor class that it is, if {@link #encode}'s extra functionality isn't
 * needed.
 *
 * **Note:** This class implements a one-way encoding. It is not possible to
 * recover the original active objects that were encoded (or even copies
 * thereof). This is intentional; this class is just for logging, and it is
 * specifically not appropriate to use it as part of a data storage/retrieval
 * system, RPC mechanism, or similar.
 */
export class LoggedValueEncoder extends BaseValueVisitor {
  // @defaultConstructor

  /** @override */
  _impl_isProxyAware() {
    return true;
  }

  /** @override */
  _impl_shouldRef(value) {
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return (value.length > 10);
      } else if (AskIf.plainObject(value)) {
        return (Object.entries(value).length > 10);
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  /** @override */
  _impl_visitArray(node) {
    return this._prot_visitArrayProperties(node);
  }

  /** @override */
  _impl_visitBigInt(node) {
    // Bigints aren't JSON-encodable.
    return { '@BigInt': `${node}` };
  }

  /** @override */
  _impl_visitClass(node) {
    return this._prot_labelFromValue(node);
  }

  /** @override */
  _impl_visitError(node) {
    const [cls, mainProps, otherProps] = ErrorUtil.deconstructError(node);
    const className  = this._prot_nameFromValue(cls);
    const loggedBody = {
      ...mainProps,
      ...otherProps
    };

    if (loggedBody.name === className) {
      delete loggedBody.name;
    }

    if (loggedBody.stack instanceof StackTrace) {
      // Elide the outer `{ @StackTrace: [...] }` cladding, which is just noise
      // in this context.
      loggedBody.stack = loggedBody.stack.frames;
    }

    const loggedForm = { [`@${className}`]: loggedBody };

    return this._prot_visitObjectProperties(loggedForm);
  }

  /** @override */
  _impl_visitFunction(node) {
    return this._prot_labelFromValue(node);
  }

  /** @override */
  _impl_visitInstance(node) {
    if (typeof node.deconstruct === 'function') {
      const [cls, ...rest] = node.deconstruct();
      const className  = `@${this._prot_nameFromValue(cls)}`;
      const loggedForm = { [className]: rest };

      return this._prot_visitObjectProperties(loggedForm);
    } else {
      return this._prot_labelFromValue(node);
    }
  }

  /** @override */
  _impl_visitPlainObject(node) {
    return this._prot_visitObjectProperties(node);
  }

  /** @override */
  _impl_visitProxy(node, isFunction_unused) {
    return this._prot_labelFromValue(node);
  }

  /** @override */
  _impl_visitSymbol(node) {
    // Symbols aren't JSON-encodable.
    return this._prot_labelFromValue(node);
  }

  /** @override */
  _impl_visitUndefined(node_unused) {
    // `undefined` isn't JSON-encodable.
    return { '@undefined': [] };
  }

  //
  // Static members
  //

  /**
   * Encodes an arbitrary value for use as logged data.
   *
   * @param {*} value The value to encode.
   * @returns {*} The encoded form.
   */
  static encode(value) {
    const encoder   = new LoggedValueEncoder(value);
    const firstPass = encoder.visitSync();

    if (encoder.hasRefs()) {
      const rewriter = new this.#DefRewriter(firstPass, encoder);
      const result = rewriter.visitSync();
      return result;
    } else {
      return firstPass;
    }
  }

  /**
   * Visitor class that replaces the defining point of each reffed object with a
   * "def" object.
   */
  static #DefRewriter = class DefRewriter extends BaseValueVisitor {
    /**
     * The (outer) instance which produced the result to be tweaked.
     *
     * @type {LoggedValueEncoder}
     */
    #encoder;

    /**
     * Constructs an instance.
     *
     * @param {*} value The first pass result of encoding the original value.
     * @param {LoggedValueEncoder} encoder The instance which did the encoding.
     */
    constructor(value, encoder) {
      super(value);
      this.#encoder = encoder;
    }

    /** @override */
    _impl_visitArray(node) {
      const result = this._prot_visitArrayProperties(node);
      return this.#makeDefIfAppropriate(node, result);
    }

    /** @override */
    _impl_visitPlainObject(node) {
      const result = this._prot_visitObjectProperties(node);
      return this.#makeDefIfAppropriate(node, result);
    }

    /**
     * Wraps a result in a "def" if it is in fact a defining value occurrence.
     *
     * @param {*} node First-pass encoding result value which _might_ be a
     *   defining value.
     * @param {*} result Second-pass encoding of `result`.
     * @returns {*} a "def" wrapper of `result` if `node` is a defining
     *   occurrence, or just `result` if not.
     */
    #makeDefIfAppropriate(node, result) {
      const ref = this.#encoder.refFromResultValue(node);

      return ref ? ref.def : result;
    }
  };
}
