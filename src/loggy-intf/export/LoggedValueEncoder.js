// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

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
 * visitor class that it is.
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
    switch (typeof value) {
      case 'function': {
        return false;
      }

      case 'object': {
        return true;
      }

      default: {
        return false;
      }
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
    const visitor = new LoggedValueEncoder(value);
    return visitor.visitSync();
  }
}
