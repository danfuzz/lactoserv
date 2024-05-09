// Copyright 2022-2024 the Lactoserv Authors (Dan Bornstein et alia).
// SPDX-License-Identifier: Apache-2.0

/**
 * Base class for proxy handlers, which implements all methods in the most
 * "no-oppy" way possible. By default, if a proxy handler doesn't implement a
 * method, the equivalent operation is attempted on the proxy target. This class
 * explicitly implements _all_ proxy handler methods, so subclasses can be sure
 * that the target is only accessed if code in the subclass explicitly allows
 * it. The _one_ exception is that {@link #getPrototypeOf} per spec needs to
 * return the prototype of the target when {@link #isExtensible} returns `false`
 * (which it does on this class), so that's what's implemented.
 *
 * In addition, this class provides a static method {@link #makeProxy} for
 * convenient proxy construction.
 */
export class BaseProxyHandler {
  // @defaultConstructor

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {object} thisArg_unused The `this` argument passed to the call.
   * @param {Array<*>} args_unused List of arguments passed to the call.
   */
  apply(target_unused, thisArg_unused, args_unused) {
    throw new Error('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {Array<*>} args_unused List of arguments passed to the constructor.
   * @param {object} newTarget_unused The constructor that was originally
   *   called, which is to say, the proxy object.
   */
  construct(target_unused, args_unused, newTarget_unused) {
    throw new Error('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property_unused The property name.
   * @param {object} descriptor_unused The property descriptor.
   * @returns {boolean} `false`, always.
   */
  defineProperty(target_unused, property_unused, descriptor_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string} property_unused The property name.
   * @returns {boolean} `false`, always.
   */
  deleteProperty(target_unused, property_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property_unused The property name.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {undefined} `undefined`, always.
   */
  get(target_unused, property_unused, receiver_unused) {
    return undefined;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property_unused The property name.
   */
  getOwnPropertyDescriptor(target_unused, property_unused) {
    throw new Error('Unsupported proxy operation.');
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target The proxy target.
   * @returns {*} `target`'s prototype.
   */
  getPrototypeOf(target) {
    // **Note:** In the original version of this class, this method was
    // implemented as simply `return null`. However, the Babel polyfill code for
    // `Proxy` complained thusly:
    //
    //   Proxy's 'getPrototypeOf' trap for a non-extensible target should return
    //   the same value as the target's prototype
    //
    // The Mozilla docs for `Proxy` agree with this assessment, stating:
    //
    //   If `target` is not extensible, `Object.getPrototypeOf(proxy)` method
    //   must return the same value as `Object.getPrototypeOf(target).`
    //
    // Hence this revised version.

    return Object.getPrototypeOf(target);
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property_unused The property name.
   * @returns {boolean} `false`, always.
   */
  has(target_unused, property_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {boolean} `false`, always.
   */
  isExtensible(target_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {Array<string>} `[]`, always.
   */
  ownKeys(target_unused) {
    return [];
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @returns {boolean} `true`, always.
   */
  preventExtensions(target_unused) {
    return true;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {string|symbol} property_unused The property name.
   * @param {*} value_unused The new property value.
   * @param {object} receiver_unused The original receiver of the request.
   * @returns {boolean} `false`, always.
   */
  set(target_unused, property_unused, value_unused, receiver_unused) {
    return false;
  }

  /**
   * Standard `Proxy` handler method.
   *
   * @param {object} target_unused The proxy target.
   * @param {?object} prototype_unused The new prototype.
   * @returns {boolean} `false`, always.
   */
  setPrototypeOf(target_unused, prototype_unused) {
    return false;
  }


  //
  // Static members
  //

  /**
   * Constructs and returns a proxy which wraps an instance of this class, and
   * with a frozen no-op function as the target. The instance of this class is
   * constructed with whatever arguments get passed to this method.
   *
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler and which adopts a baseline identity as a function.
   */
  static makeFunctionProxy(...args) {
    const handler      = new this(...args);
    const fakeFunction = BaseProxyHandler.#makeNamedFunction();

    return new Proxy(Object.freeze(fakeFunction), handler);
  }

  /**
   * Constructs and returns a proxy which wraps an instance of this class, and
   * with a frozen pseudo-instance of the given class as the target which is
   * also considered to be a callable function. The instance of this class is
   * constructed with whatever arguments get passed to this method.
   *
   * @param {function(new:*)} targetCls Class to pseudo-instantiate as the
   *   target.
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler and which adopts a baseline identity as a function.
   */
  static makeFunctionInstanceProxy(targetCls, ...args) {
    const handler      = new this(...args);
    const fakeInstance = BaseProxyHandler.#makeNamedFunction(targetCls);

    Object.setPrototypeOf(fakeInstance, targetCls.prototype);
    Object.freeze(fakeInstance);

    return new Proxy(fakeInstance, handler);
  }

  /**
   * Constructs and returns a proxy which wraps an instance of this class, and
   * with a frozen pseudo-instance of the given class as the target. The
   * instance of this class is constructed with whatever arguments get passed to
   * this method.
   *
   * @param {function(new:*)} targetCls Class to pseudo-instantiate as the
   *   target.
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler and which adopts a baseline identity as a function.
   */
  static makeInstanceProxy(targetCls, ...args) {
    // **Note:** `this` in the context of a static method is the class.
    const handler = new this(...args);

    const notQuiteInstance = Object.freeze(Object.create(targetCls.prototype));
    return new Proxy(notQuiteInstance, handler);
  }

  /**
   * Constructs and returns a proxy which wraps an instance of this class, and
   * with a frozen empty object as the target (with optional configuration). The
   * instance of this class is constructed with whatever arguments get passed to
   * this method.
   *
   * @param {object} options Proxy target options.
   * @param {boolean} [options.callable] Use a function for the proxy target?
   * @param {?function(new:*)} [options.class] Class to claim for the proxy
   *   target, or `null` to simply claim to be a plain object (or function, if
   *   `function === true`).
   * @param {?string} [options.name] `name` property of the target, or `null` to
   *   be anonymous. This is only used if `function === true`.
   * @param {...*} args Construction arguments to pass to this class's
   *   constructor.
   * @returns {Proxy} Proxy instance which uses an instance of this class as its
   *   handler.
   */
  static makeProxy({ callable = false, class: targetCls = null, name = null }, ...args) {
    const handler = new this(...args);

    let target;
    if (callable) {
      if ((name ?? '') === '') {
        // `null ??` to force the function to be anonymous, that is, to _not_
        // "inherit" the name of the variable it's stored in.
        target = null ?? (() => null);
      } else {
        // This bit of mishegas is about the best way to dynamically set the
        // name of a function.
        const forceName = {
          [name]: () => null
        };
        target = forceName[name];
      }

      if (targetCls) {
        Object.setPrototypeOf(target, targetCls.prototype);
      }
    } else if (targetCls) {
      target = Object.create(targetCls.prototype);
    } else {
      target = {};
    }

    return new Proxy(Object.freeze(target), handler);
  }

  /**
   * Makes a no-op function with the same name as the given function.
   *
   * @param {?function()} [target] The target to imitate.
   * @returns {function()} The function.
   */
  static #makeNamedFunction(target = null) {
    const name = target?.name ?? '';

    if (name === '') {
      return () => null;
    }

    // This bit of mishegas is about the best way to dynamically set the name of
    // a function.
    const forceName = {
      [name]: () => null
    };

    return forceName[name];
  }
}
