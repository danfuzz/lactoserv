// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

import { Sexp } from '@this/codec';
import { AskIf } from '@this/typey';
import { BaseValueVisitor, ErrorUtil } from '@this/util';


/**
 * Standard way to encode values used in logged events, such that they become
 * (as close as possible to) simple immutable data. This is where, e.g., class
 * instances (that aren't special-cased) get converted into non-instance
 * objects.
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
        return AskIf.callableFunction(value);
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
  _impl_visitClass(node) {
    return this._prot_nameFromValue(node);
  }

  /** @override */
  _impl_visitError(node) {
    const decon   = ErrorUtil.deconstructError(node);
    const visited = this._prot_visitArrayProperties(decon);

    return new Sexp(...visited);
  }

  /** @override */
  _impl_visitFunction(node) {
    return this._prot_nameFromValue(node);
  }

  /** @override */
  _impl_visitInstance(node) {
    if (typeof node.deconstruct === 'function') {
      const decon   = node.deconstruct();
      const visited = this._prot_visitArrayProperties(decon);
      return new Sexp(...visited);
    } else {
      return this._prot_nameFromValue(node);
    }
  }

  /** @override */
  _impl_visitPlainObject(node) {
    return this._prot_visitObjectProperties(node);
  }

  /** @override */
  _impl_visitProxy(node, isFunction_unused) {
    return this._prot_nameFromValue(node);
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
